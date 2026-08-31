import { Composer, InlineKeyboard } from "grammy";
import { MyContext } from "../bot.types.js";
import { BookingModel, BookingStatus } from "../models/Booking.js";
import { UserModel, UserRole } from "../models/User.js";
import { InstructorProfileModel } from "../models/InstructorProfile.js";
import { createConversation } from "@grammyjs/conversations";

export const instructorComposer = new Composer<MyContext>();

const isInstructor = async (ctx: MyContext) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return false;
    const user = await UserModel.findOne({ telegramId, role: UserRole.INSTRUCTOR });
    return !!user;
};

export async function editProfileConversation(conversation: any, ctx: MyContext) {
    const telegramId = ctx.from?.id!;

    // Ma'lumotlarni bazadan olish
    const existingUser = await UserModel.findOne({ telegramId });
    const existingProfile = await InstructorProfileModel.findOne({ userId: telegramId });

    await ctx.reply(`Yangi Ism Familiyangizni kiriting\n(Joriy ismingiz: ${existingUser?.fullName || "Kiritilmagan"})\n\nO'zgartirmaslik uchun /skip ni yuboring:`);
    const nameCtx = await conversation.wait();
    const nameText = nameCtx.message?.text?.trim();
    if (nameText && nameText.toLowerCase() !== '/skip') {
        await UserModel.updateOne({ telegramId }, { fullName: nameText });
    }

    const currentCar = existingProfile ? `${existingProfile.carModel}, ${existingProfile.carNumber}` : "Kiritilmagan";
    await ctx.reply(`Yangi Avtomobil modeli va raqamini vergul bilan ajratib kiriting (Joriy avtomobil: ${currentCar}).\n\nO'zgartirmaslik uchun /skip ni yuboring:`);
    const carCtx = await conversation.wait();
    const carText = carCtx.message?.text?.trim();

    let carModel = existingProfile?.carModel;
    let carNumber = existingProfile?.carNumber;

    if (carText && carText.toLowerCase() !== '/skip') {
        const parts = carText.split(',');
        carModel = parts[0]?.trim() || carText;
        carNumber = parts[1]?.trim() || "N/A";
    }

    const currentTrans = existingProfile?.transmission === 'MANUAL' ? '🕹 Mexanika' : '🅰️ Avtomat';
    const transmissionKb = new InlineKeyboard()
        .text("🕹 Mexanika", "trans_MANUAL")
        .text("🅰️ Avtomat", "trans_AUTOMATIC")
        .row()
        .text("🔙 Eskisini qoldirish", "trans_SKIP");

    await ctx.reply(`Yangi Uzatish qutisi (Transmission) turini tanlang (Joriy: ${currentTrans}):`, { reply_markup: transmissionKb });

    const transCtx = await conversation.waitForCallbackQuery(["trans_MANUAL", "trans_AUTOMATIC", "trans_SKIP"]);
    let transmission = existingProfile?.transmission;
    if (transCtx.match !== 'trans_SKIP') {
        transmission = transCtx.match === "trans_MANUAL" ? "MANUAL" : "AUTOMATIC";
    }
    await transCtx.answerCallbackQuery();

    await InstructorProfileModel.updateOne({ userId: telegramId }, {
        carModel,
        carNumber,
        transmission
    });

    await ctx.reply("Profil muvaffaqiyatli yangilandi! 🎉", {
        reply_markup: { remove_keyboard: true }
    });
}

instructorComposer.use(createConversation(editProfileConversation));

instructorComposer.command('admin', async (ctx) => {
    if (!(await isInstructor(ctx))) return ctx.reply("Ruxsat yo'q.");

    const kb = new InlineKeyboard()
        .text('📅 Mening Grafigim (Bugun / Ertaga)', 'inst_schedule').row()
        .text('📥 Kutilayotgan So\'rovlar', 'inst_pending').row()
        .text('⚙️ Profil Sozlamalari', 'inst_settings');

    await ctx.reply("Sizning Instruktor panelingiz:", { reply_markup: kb });
});

instructorComposer.callbackQuery('inst_pending', async (ctx) => {
    if (!(await isInstructor(ctx))) return;
    const telegramId = ctx.from?.id!;

    const pendings = await BookingModel.find({ instructorId: telegramId, status: BookingStatus.PENDING });
    if (pendings.length === 0) {
        return ctx.answerCallbackQuery({ text: "Yangi so'rovlar yo'q.", show_alert: true });
    }

    await ctx.answerCallbackQuery();
    for (const b of pendings) {
        const user = await UserModel.findOne({ telegramId: b.studentId });
        const msg = `So'rov:\n👤 ${user?.fullName || "Noma'lum"} (${user?.phone})\n📅 ${b.date}\n⏰ ${b.startTime} - ${b.endTime}`;

        const kb = new InlineKeyboard()
            .text('✅ Tasdiqlash', `admin_approve_${b._id}`)
            .text('❌ Rad etish', `admin_reject_${b._id}`);
        await ctx.reply(msg, { reply_markup: kb });
    }
});

instructorComposer.callbackQuery('inst_schedule', async (ctx) => {
    if (!(await isInstructor(ctx))) return;
    const telegramId = ctx.from?.id!;

    const now = new Date();
    const tzOffset = 5 * 60 * 60 * 1000;
    const local = new Date(now.getTime() + tzOffset);
    const todayStr = local.toISOString().split('T')[0];
    const localTomorrow = new Date(local.getTime() + 24 * 60 * 60 * 1000);
    const tomStr = localTomorrow.toISOString().split('T')[0];

    const bookings = await BookingModel.find({
        instructorId: telegramId,
        date: { $in: [todayStr, tomStr] },
        status: { $in: [BookingStatus.APPROVED, BookingStatus.PENDING] }
    }).sort({ date: 1, startTime: 1 });

    if (bookings.length === 0) {
        return ctx.answerCallbackQuery({ text: "Bugun va ertaga darslar yo'q.", show_alert: true });
    }

    await ctx.answerCallbackQuery();
    await ctx.reply(`Sizning grafigingiz (Bugun, Ertaga):`);

    for (const b of bookings) {
        const user = await UserModel.findOne({ telegramId: b.studentId });
        let itemMsg = `🗓 ${b.date} | ⏰ ${b.startTime} - ${b.endTime}\n👤 ${user?.fullName || "Noma'lum"} (${user?.phone})\nHolati: ${b.status}`;

        const kb = new InlineKeyboard().text('🗑 Bekor qilish', `admin_delete_${b._id}`);
        await ctx.reply(itemMsg, { reply_markup: kb });
    }
});

instructorComposer.callbackQuery('inst_settings', async (ctx) => {
    if (!(await isInstructor(ctx))) return;
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("editProfileConversation");
});

instructorComposer.callbackQuery(/^admin_approve_(.+)$/, async (ctx) => {
    if (!(await isInstructor(ctx))) return;
    const bId = ctx.match[1];
    const booking = await BookingModel.findById(bId);
    if (!booking) return ctx.answerCallbackQuery("Topilmadi.");

    booking.status = BookingStatus.APPROVED;
    await booking.save();

    await ctx.answerCallbackQuery("Tasdiqlandi!");
    await ctx.editMessageText(ctx.msg!.text + "\n\n(✅ TASDIQLANDI)");

    try { await ctx.api.sendMessage(booking.studentId, `Sizning ${booking.date} dagi broningiz tasdiqlandi! 🚀`); } catch (e) { }
});

instructorComposer.callbackQuery(/^admin_reject_(.+)$/, async (ctx) => {
    if (!(await isInstructor(ctx))) return;
    const bId = ctx.match[1];
    const booking = await BookingModel.findById(bId);
    if (!booking) return ctx.answerCallbackQuery("Topilmadi.");

    booking.status = BookingStatus.REJECTED;
    await booking.save();

    await ctx.answerCallbackQuery("Rad etildi!");
    await ctx.editMessageText(ctx.msg!.text + "\n\n(❌ RAD ETILDI)");

    try { await ctx.api.sendMessage(booking.studentId, "Afsuski, broningiz rad etildi."); } catch (e) { }
});

instructorComposer.callbackQuery(/^admin_delete_(.+)$/, async (ctx) => {
    if (!(await isInstructor(ctx))) return;
    const bId = ctx.match[1];
    const booking = await BookingModel.findById(bId);
    if (!booking) return ctx.answerCallbackQuery("Topilmadi.");

    booking.status = BookingStatus.CANCELLED;
    await booking.save();

    await ctx.answerCallbackQuery("Bekor qilindi!");
    await ctx.editMessageText(ctx.msg!.text + "\n\n(🗑 BEKOR QILINDI)");

    try { await ctx.api.sendMessage(booking.studentId, `Sizning ${booking.date} dagi darsingiz o'qituvchi tomonidan bekor qilindi.`); } catch (e) { }
});
