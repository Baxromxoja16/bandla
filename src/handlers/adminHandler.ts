import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../bot.types.js';
import { Booking, BookingStatus } from '../models/Booking.js';
import { User } from '../models/User.js';
import { getAdminDateKeyboard } from '../keyboards/adminKeyboards.js';
import 'dotenv/config';

export const adminComposer = new Composer<MyContext>();

const isAdmin = (ctx: MyContext) => {
    return ctx.from?.id.toString() === process.env.ADMIN_TELEGRAM_ID;
};

adminComposer.command('admin', async (ctx) => {
    if (!isAdmin(ctx)) return;

    const kb = getAdminDateKeyboard();
    await ctx.reply("Sana tanlang:", { reply_markup: kb });
});

adminComposer.callbackQuery(/^admin_date_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const date = ctx.match[1];

    const bookings = await Booking.find({ date, status: { $in: [BookingStatus.APPROVED, BookingStatus.PENDING] } }).sort({ startTime: 1 });

    let msg = `📅 GRAFIK (${date}):\n\n`;

    if (bookings.length === 0) {
        msg += "Ushbu kunga bronlar yo'q.";
    }

    await ctx.reply(msg);

    for (let i = 0; i < bookings.length; i++) {
        const b = bookings[i];
        const user = await User.findOne({ telegramId: b.userId });

        let itemMsg = `${i + 1}. 👤 ${user?.fullName || 'Noma\'lum'} (${user?.phone || ''})\n⏰ ${b.startTime} — ${b.endTime} (${b.durationMinutes / 60} hrs) | Status: ${b.status === BookingStatus.APPROVED ? '✅ APPROVED' : '⏳ PENDING'}`;

        let inlineKeyboard = new InlineKeyboard();
        if (b.status === BookingStatus.PENDING) {
            inlineKeyboard.text('✅ Tasdiqlash', `admin_approve_${b._id}`);
        }
        inlineKeyboard.text('🗑 O\'chirish', `admin_delete_${b._id}`);

        await ctx.reply(itemMsg, { reply_markup: inlineKeyboard });
    }

    await ctx.answerCallbackQuery();
});

adminComposer.callbackQuery(/^admin_approve_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const bId = ctx.match[1];

    const booking = await Booking.findById(bId);
    if (!booking) return ctx.answerCallbackQuery("Topilmadi.");

    booking.status = BookingStatus.APPROVED;
    await booking.save();

    await ctx.answerCallbackQuery("Tasdiqlandi!");
    await ctx.editMessageText(ctx.msg!.text + "\n\n(✅ TASDIQLANDI)");

    try {
        await ctx.api.sendMessage(booking.userId, "Sizning broningiz tasdiqlandi! 🚀");
    } catch (e) {
        console.error("User blocked bot", e);
    }
});

adminComposer.callbackQuery(/^admin_reject_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const bId = ctx.match[1];

    const booking = await Booking.findById(bId);
    if (!booking) return ctx.answerCallbackQuery("Topilmadi.");

    booking.status = BookingStatus.REJECTED;
    await booking.save();

    await ctx.answerCallbackQuery("Rad etildi!");
    await ctx.editMessageText(ctx.msg!.text + "\n\n(❌ RAD ETILDI)");

    try {
        await ctx.api.sendMessage(booking.userId, "Afsuski, broningiz rad etildi.");
    } catch (e) { }
});

adminComposer.callbackQuery(/^admin_delete_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const bId = ctx.match[1];

    const booking = await Booking.findById(bId);
    if (!booking) return ctx.answerCallbackQuery("Topilmadi.");

    booking.status = BookingStatus.CANCELLED;
    await booking.save();

    await ctx.answerCallbackQuery("O'chirildi (Bekor qilindi)!");
    await ctx.editMessageText(ctx.msg!.text + "\n\n(🗑 O'CHIRILDI)");

    try {
        await ctx.api.sendMessage(booking.userId, `Sizning ${booking.date} dagi ${booking.startTime} vaqtidagi darsingiz o'qituvchi tomonidan bekor qilindi.`);
    } catch (e) { }
});

adminComposer.callbackQuery(/^admin_blacklist_(.+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return;
    const bId = ctx.match[1];

    const booking = await Booking.findById(bId);
    if (!booking) return ctx.answerCallbackQuery("Topilmadi.");

    const user = await User.findOne({ telegramId: booking.userId });
    if (user) {
        user.isBlacklisted = !user.isBlacklisted;
        await user.save();
        const msg = user.isBlacklisted ? "Qora ro'yxatga olindi." : "Qora ro'yxatdan chiqarildi.";
        await ctx.answerCallbackQuery(msg);
        await ctx.editMessageText(ctx.msg!.text + `\n\n(${user.isBlacklisted ? "🚫 QORA RO'YXATGA OLINDI" : "🟢 QORA RO'YXATDAN CHIQARILDI"})`);
    }
});
