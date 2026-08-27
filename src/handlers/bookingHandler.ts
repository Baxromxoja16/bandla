import { Composer } from 'grammy';
import { MyContext } from '../bot.types.js';
import { getDatesKeyboard, getTimeGridKeyboard, getSmartDurationsKeyboard, getConfirmationKeyboard } from '../keyboards/studentKeyboards.js';
import { Booking, BookingStatus } from '../models/Booking.js';
import { getAdminBookingActionKeyboard } from '../keyboards/adminKeyboards.js';
import { timeToMinutes, minutesToTime } from '../utils/timeHelpers.js';
import { User } from '../models/User.js';

export const bookingComposer = new Composer<MyContext>();

const ensureUser = async (telegramId: number) => {
    return await User.findOne({ telegramId });
};

bookingComposer.command('book', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;
    const user = await ensureUser(telegramId);
    if (!user) return ctx.reply("Iltimos, avval /start ni bosing.");

    const kb = getDatesKeyboard();
    await ctx.reply("Dars uchun sanani tanlang:", { reply_markup: kb });
});

bookingComposer.callbackQuery('back_to_dates', async (ctx) => {
    const kb = getDatesKeyboard();
    await ctx.editMessageText("Dars uchun sanani tanlang:", { reply_markup: kb });
    await ctx.answerCallbackQuery();
});

bookingComposer.callbackQuery(/^date_(.+)$/, async (ctx) => {
    const date = ctx.match[1];

    ctx.session.tempBooking = { date };

    const existingBookings = await Booking.find({ date });
    const kb = getTimeGridKeyboard(date, existingBookings);

    await ctx.editMessageText(`Sana: ${date}\nBo'sh vaqtni tanlang:`, { reply_markup: kb });
    await ctx.answerCallbackQuery();
});

bookingComposer.callbackQuery('noop', async (ctx) => {
    await ctx.answerCallbackQuery();
});

bookingComposer.callbackQuery(/^time_(.+)_(.+)$/, async (ctx) => {
    const date = ctx.match[1];
    const time = ctx.match[2];

    ctx.session.tempBooking = { date, startTime: time };

    const existingBookings = await Booking.find({ date });
    const kb = getSmartDurationsKeyboard(time, date, existingBookings);

    await ctx.editMessageText(`Sana: ${date}\nBoshlanish vaqti: ${time}\n\nDars davomiyligini tanlang:`, { reply_markup: kb });
    await ctx.answerCallbackQuery();
});

bookingComposer.callbackQuery(/^duration_(.+)_(.+)_(.+)$/, async (ctx) => {
    const date = ctx.match[1];
    const startTime = ctx.match[2];
    const duration = parseInt(ctx.match[3]);
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    ctx.session.tempBooking = { date, startTime, durationMinutes: duration };

    const user = await User.findOne({ telegramId });
    if (!user) return;

    const startMins = timeToMinutes(startTime);
    const endTime = minutesToTime(startMins + duration);

    const msg = `📋 BRON MA'LUMOTLARI:
📅 Sana: ${date}
⏰ Vaqt: ${startTime} — ${endTime} (${duration / 60} soat)
👤 O'quvchi: ${user.fullName}
📞 Tel: ${user.phone}`;

    const kb = getConfirmationKeyboard(date, startTime, duration);
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
});

bookingComposer.callbackQuery('cancel_booking', async (ctx) => {
    ctx.session.tempBooking = {};
    const kb = getDatesKeyboard();
    await ctx.editMessageText("Bron bekor qilindi. Boshqa sana tanlaysizmi?", { reply_markup: kb });
    await ctx.answerCallbackQuery();
});

bookingComposer.callbackQuery(/^confirm_(.+)_(.+)_(.+)$/, async (ctx) => {
    const date = ctx.match[1];
    const startTime = ctx.match[2];
    const duration = parseInt(ctx.match[3]);
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const user = await User.findOne({ telegramId });
    if (!user) return;

    const existingBookings = await Booking.find({ date, status: { $in: [BookingStatus.APPROVED, BookingStatus.PENDING] } });
    const newStart = timeToMinutes(startTime);
    const newEnd = newStart + duration;

    const hasOverlap = existingBookings.some(b => {
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        return (newStart < bEnd) && (newEnd > bStart);
    });

    if (hasOverlap) {
        return ctx.answerCallbackQuery({ text: "Afsuski, bu vaqt oraliqida boshqa bron mavjud. Boshqa vaqt tanlang.", show_alert: true });
    }

    const booking = new Booking({
        userId: telegramId,
        date,
        startTime,
        endTime: minutesToTime(newEnd),
        durationMinutes: duration,
        status: BookingStatus.PENDING
    });

    await booking.save();

    await ctx.editMessageText("Sizning so'rovingiz qabul qilindi. Tasdiqlanishini kuting.");
    await ctx.answerCallbackQuery();

    const adminId = process.env.ADMIN_TELEGRAM_ID;
    if (adminId) {
        const warning = user.isBlacklisted ? "🔴 QORA RO'YXATDA!" : "🟢 Ishonchli";
        const adminMsg = `📥 YANGI BRON SO'ROVI #${booking._id}

👤 O'quvchi: ${user.fullName} (${user.phone})
📅 Sana: ${date}
⏰ Vaqt: ${startTime} — ${booking.endTime} (${duration / 60} soat)
⚠️ Status: ${warning}`;

        try {
            await ctx.api.sendMessage(adminId, adminMsg, {
                reply_markup: getAdminBookingActionKeyboard(booking._id.toString())
            });
        } catch (e) {
            console.error("Failed to send to admin", e);
        }
    }
});
