import { Composer } from "grammy";
import { MyContext } from "../bot.types.js";
import { getInstructorsKeyboard, getDatesKeyboard, getTimeGridKeyboard, getSmartDurationsKeyboard, getConfirmationKeyboard } from "../keyboards/studentKeyboards.js";
import { BookingModel, BookingStatus } from "../models/Booking.js";
import { InstructorProfileModel } from "../models/InstructorProfile.js";
import { UserModel, UserRole } from "../models/User.js";
import { timeToMinutes, minutesToTime } from "../utils/timeHelpers.js";

export const studentComposer = new Composer<MyContext>();

const ensureStudent = async (ctx: MyContext) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return null;
    return await UserModel.findOne({ telegramId, role: UserRole.STUDENT });
};

studentComposer.command("book", async (ctx) => {
    const user = await ensureStudent(ctx);
    if (!user) return ctx.reply("Siz o'quvchi sifatida ro'yxatdan o'tmagansiz. /start bosing.");

    const profiles = await InstructorProfileModel.find({ isAvailable: true });
    if (profiles.length === 0) return ctx.reply("Afsuski, hozircha bo'sh instruktorlar yo'q.");

    const instructorsData = await Promise.all(profiles.map(async p => {
        const u = await UserModel.findOne({ telegramId: p.userId });
        return {
            ...p.toObject(),
            fullName: u?.fullName || "Noma'lum"
        };
    }));

    const kb = getInstructorsKeyboard(instructorsData as any);
    await ctx.reply("Dars uchun Instruktorni tanlang:", { reply_markup: kb });
});

studentComposer.callbackQuery("back_to_instructors", async (ctx) => {
    const profiles = await InstructorProfileModel.find({ isAvailable: true });
    const instructorsData = await Promise.all(profiles.map(async p => {
        const u = await UserModel.findOne({ telegramId: p.userId });
        return { ...p.toObject(), fullName: u?.fullName || "Noma'lum" };
    }));
    await ctx.editMessageText("Dars uchun Instruktorni tanlang:", { reply_markup: getInstructorsKeyboard(instructorsData as any) });
    await ctx.answerCallbackQuery();
});

studentComposer.callbackQuery(/^select_inst_(.+)$/, async (ctx) => {
    const instId = parseInt(ctx.match[1]);
    ctx.session.tempBooking = { instructorId: instId };

    const kb = getDatesKeyboard();
    await ctx.editMessageText("Dars uchun sanani tanlang:", { reply_markup: kb });
    await ctx.answerCallbackQuery();
});

studentComposer.callbackQuery('back_to_dates', async (ctx) => {
    const kb = getDatesKeyboard();
    await ctx.editMessageText("Dars uchun sanani tanlang:", { reply_markup: kb });
    await ctx.answerCallbackQuery();
});

studentComposer.callbackQuery(/^date_(.+)$/, async (ctx) => {
    const date = ctx.match[1];
    const instId = ctx.session.tempBooking?.instructorId;
    if (!instId) return ctx.answerCallbackQuery("Xatolik! Qaytadan urinib ko'ring.");

    ctx.session.tempBooking.date = date;

    const existingBookings = await BookingModel.find({ instructorId: instId, date });
    const kb = getTimeGridKeyboard(date, existingBookings);

    await ctx.editMessageText(`Sana: ${date}\nBo'sh vaqtni tanlang:`, { reply_markup: kb });
    await ctx.answerCallbackQuery();
});

studentComposer.callbackQuery('noop', async (ctx) => {
    await ctx.answerCallbackQuery();
});

studentComposer.callbackQuery(/^time_(.+)_(.+)$/, async (ctx) => {
    const date = ctx.match[1];
    const time = ctx.match[2];
    const instId = ctx.session.tempBooking?.instructorId;
    if (!instId) return ctx.answerCallbackQuery();

    ctx.session.tempBooking.startTime = time;

    const existingBookings = await BookingModel.find({ instructorId: instId, date });
    const kb = getSmartDurationsKeyboard(time, date, existingBookings);

    await ctx.editMessageText(`Sana: ${date}\nBoshlanish vaqti: ${time}\n\nDars davomiyligini tanlang:`, { reply_markup: kb });
    await ctx.answerCallbackQuery();
});

studentComposer.callbackQuery(/^duration_(.+)$/, async (ctx) => {
    const duration = parseInt(ctx.match[1]);
    const { instructorId, date, startTime } = ctx.session.tempBooking || {};
    if (!instructorId || !date || !startTime) return ctx.answerCallbackQuery("Xatolik!");

    ctx.session.tempBooking!.durationMinutes = duration;

    const user = await UserModel.findOne({ telegramId: ctx.from.id });
    const instUser = await UserModel.findOne({ telegramId: instructorId });
    if (!user || !instUser) return;

    const startMins = timeToMinutes(startTime);
    const endTime = minutesToTime(startMins + duration);

    const msg = `📋 BRON MA'LUMOTLARI:
👨‍🏫 Instruktor: ${instUser.fullName}
📅 Sana: ${date}
⏰ Vaqt: ${startTime} — ${endTime} (${duration / 60} soat)
👤 O'quvchi: ${user.fullName}
📞 Tel: ${user.phone}`;

    const kb = getConfirmationKeyboard();
    await ctx.editMessageText(msg, { reply_markup: kb });
    await ctx.answerCallbackQuery();
});

studentComposer.callbackQuery('cancel_booking', async (ctx) => {
    ctx.session.tempBooking = {};
    await ctx.editMessageText("Bron bekor qilindi. Boshqa tanlov uchun /book ni bosing.");
    await ctx.answerCallbackQuery();
});

studentComposer.callbackQuery('confirm_booking', async (ctx) => {
    const { instructorId, date, startTime, durationMinutes } = ctx.session.tempBooking || {};
    const telegramId = ctx.from?.id;
    if (!telegramId || !instructorId || !date || !startTime || !durationMinutes) return ctx.answerCallbackQuery();

    const user = await UserModel.findOne({ telegramId });
    if (!user) return;

    const existingBookings = await BookingModel.find({ instructorId, date, status: { $in: [BookingStatus.APPROVED, BookingStatus.PENDING] } });
    const newStart = timeToMinutes(startTime);
    const newEnd = newStart + durationMinutes;

    const hasOverlap = existingBookings.some(b => {
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        return (newStart < bEnd) && (newEnd > bStart);
    });

    if (hasOverlap) {
        return ctx.answerCallbackQuery({ text: "Afsuski, bu vaqt band qilingan. Boshqa vaqt tanlang.", show_alert: true });
    }

    const booking = new BookingModel({
        studentId: telegramId,
        instructorId,
        date,
        startTime,
        endTime: minutesToTime(newEnd),
        durationMinutes,
        status: BookingStatus.PENDING
    });

    await booking.save();

    await ctx.editMessageText("Sizning so'rovingiz qabul qilindi. Tasdiqlanishini kuting.");
    await ctx.answerCallbackQuery();

    const adminMsg = `📥 YANGI BRON SO'ROVI #${booking._id}

👤 O'quvchi: ${user.fullName} (${user.phone})
📅 Sana: ${date}
⏰ Vaqt: ${startTime} — ${booking.endTime} (${durationMinutes / 60} soat)`;

    try {
        const InlineKeyboardLib = await import('grammy');
        const kb = new InlineKeyboardLib.InlineKeyboard()
            .text('✅ Tasdiqlash', `admin_approve_${booking._id}`)
            .text('❌ Rad etish', `admin_reject_${booking._id}`);
        await ctx.api.sendMessage(instructorId, adminMsg, { reply_markup: kb });
    } catch (e) {
        console.error("Failed to send booking to instructor", e);
    }
});
