import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../bot.types.js';
import { BookingModel, BookingStatus } from '../models/Booking.js';
import { UserModel, UserRole } from '../models/User.js';

export const myBookingsComposer = new Composer<MyContext>();

myBookingsComposer.command('my_bookings', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const user = await UserModel.findOne({ telegramId, role: UserRole.STUDENT });
    if (!user) {
        return ctx.reply("Siz o'quvchi emassiz.");
    }

    const bookings = await BookingModel.find({ studentId: telegramId }).sort({ date: 1, startTime: 1 });
    if (bookings.length === 0) {
        return ctx.reply("Sizda hali bronlar yo'q.");
    }

    for (const b of bookings) {
        let statusEmoji = '⏳ Kutilyapti';
        if (b.status === BookingStatus.APPROVED) statusEmoji = '✅ Tasdiqlangan';
        if (b.status === BookingStatus.REJECTED) statusEmoji = '❌ Rad etilgan';
        if (b.status === BookingStatus.CANCELLED) statusEmoji = '🗑 Bekor qilingan';

        const instUser = await UserModel.findOne({ telegramId: b.instructorId });

        const msg = `📅 Sana: ${b.date}\n⏰ Vaqt: ${b.startTime} — ${b.endTime}\n👨‍🏫 Instruktor: ${instUser?.fullName || 'N/A'}\n⚠️ Status: ${statusEmoji}`;

        let kb = new InlineKeyboard();
        if (b.status === BookingStatus.PENDING || b.status === BookingStatus.APPROVED) {
            const now = new Date();
            const bookingDate = new Date(`${b.date}T${b.startTime}:00+05:00`);
            const diffMs = bookingDate.getTime() - now.getTime();
            if (diffMs > 2 * 60 * 60 * 1000) {
                kb.text("❌ Bekor qilish", `user_cancel_${b._id}`);
            } else {
                kb.text("Bekor qilish muddati o'tdi", "noop");
            }
        }
        await ctx.reply(msg, { reply_markup: kb });
    }
});

myBookingsComposer.callbackQuery(/^user_cancel_(.+)$/, async (ctx) => {
    const id = ctx.match[1];
    const booking = await BookingModel.findById(id);
    if (!booking) return ctx.answerCallbackQuery("Topilmadi.");

    const now = new Date();
    const bookingDate = new Date(`${booking.date}T${booking.startTime}:00+05:00`);
    const diffMs = bookingDate.getTime() - now.getTime();

    if (diffMs <= 2 * 60 * 60 * 1000) {
        return ctx.answerCallbackQuery({ text: "Bekor qilish muddati o'tdi.", show_alert: true });
    }

    booking.status = BookingStatus.CANCELLED;
    await booking.save();
    await ctx.editMessageText(ctx.msg!.text + "\n\n(Siz tomoningizdan bekor qilindi 🗑)");
    await ctx.answerCallbackQuery("Bekor qilindi");

    try {
        await ctx.api.sendMessage(booking.instructorId, `O'quvchi ${booking.date} kunidagi bronni bekor qildi.`);
    } catch { }
});
