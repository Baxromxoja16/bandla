import { Composer, InlineKeyboard, Keyboard } from "grammy";
import { MyContext } from "../bot.types.js";
import { UserModel, UserRole } from "../models/User.js";
import { InstructorProfileModel } from "../models/InstructorProfile.js";
import { createConversation } from "@grammyjs/conversations";

export const authComposer = new Composer<MyContext>();

export async function instructorSetupConversation(conversation: any, ctx: MyContext) {
    await ctx.reply("Iltimos, Ism va Familiyangizni kiriting:");
    const nameCtx = await conversation.wait();
    const fullName = nameCtx.message?.text || "Noma'lum";

    // Update User model with full name
    const telegramId = ctx.from?.id!;
    await UserModel.updateOne({ telegramId }, { fullName });

    await ctx.reply("Avtomobil modeli va raqamini vergul bilan ajratib kiriting (Masalan: Gentra, 01 A 777 AA):");
    const carCtx = await conversation.wait();
    const carDetails = carCtx.message?.text || "Kiritilmadi";

    const transmissionKb = new InlineKeyboard()
        .text("🕹 Mexanika", "trans_MANUAL")
        .text("🅰️ Avtomat", "trans_AUTOMATIC");

    await ctx.reply("Uzatish qutisi (Transmission) turini tanlang:", { reply_markup: transmissionKb });

    const transCtx = await conversation.waitForCallbackQuery(["trans_MANUAL", "trans_AUTOMATIC"]);
    const transmission = transCtx.match === "trans_MANUAL" ? "MANUAL" : "AUTOMATIC";
    await transCtx.answerCallbackQuery();

    const parts = carDetails.split(',');
    const carModel = parts[0]?.trim() || carDetails;
    const carNumber = parts[1]?.trim() || "N/A";

    const profile = new InstructorProfileModel({
        userId: telegramId,
        carModel,
        carNumber,
        transmission,
        isAvailable: true
    });
    await profile.save();

    await ctx.reply("Tabriklaymiz! Instruktor profili muvaffaqiyatli yaratildi. Boshqaruv paneli uchun /admin ni bosing.", {
        reply_markup: { remove_keyboard: true }
    });
}

authComposer.use(createConversation(instructorSetupConversation));

authComposer.command("start", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const user = await UserModel.findOne({ telegramId });
    if (user) {
        if (user.role === UserRole.INSTRUCTOR) {
            return ctx.reply(`Assalomu alaykum, Instruktor ${user.fullName}! Boshqaruv paneli uchun /admin yoki /menu buyrug'ini yuboring.`);
        } else {
            return ctx.reply(`Assalomu alaykum, ${user.fullName}! O'quvchi menyusiga xush kelibsiz.\nDars bron qilish uchun /book tugmasini bosing.`);
        }
    }

    const roleKb = new InlineKeyboard()
        .text("👨‍🎓 O'quvchi", "role_student")
        .text("👨‍🏫 Instruktor", "role_instructor");

    await ctx.reply("Assalomu alaykum! Tizimga kirish uchun rolingizni tanlang:", { reply_markup: roleKb });
});

authComposer.callbackQuery("role_student", async (ctx) => {
    const contactKb = new Keyboard()
        .requestContact("📞 Telefon raqamni yuborish")
        .resized()
        .oneTime();

    await ctx.editMessageText("O'quvchi sifatida ro'yxatdan o'tish uchun telefon raqamingizni yuboring:");
    await ctx.reply("Tugmani bosing 👇", { reply_markup: contactKb });
    await ctx.answerCallbackQuery();
});

authComposer.callbackQuery("role_instructor", async (ctx) => {
    await ctx.editMessageText("Hizmat uchun Maxfiy Kodni (Passcode) kiriting:");
    ctx.session.tempBooking = { ...ctx.session.tempBooking, date: 'AWAIT_PASSCODE' };
    await ctx.answerCallbackQuery();
});

authComposer.on("message:contact", async (ctx) => {
    const contact = ctx.message.contact;
    const telegramId = ctx.from?.id;
    if (!telegramId || !contact) return;

    let user = await UserModel.findOne({ telegramId });
    if (!user) {
        user = new UserModel({
            telegramId,
            fullName: `${contact.first_name} ${contact.last_name || ''}`.trim(),
            phone: contact.phone_number,
            role: UserRole.STUDENT
        });
        await user.save();
        await ctx.reply("O'quvchi sifatida muvaffaqiyatli ro'yxatdan o'tdingiz! 🎉\nEndi dars bron qilish uchun /book ni bosing.", {
            reply_markup: { remove_keyboard: true }
        });
    }
});

authComposer.on("message:text", async (ctx, next) => {
    if (ctx.session.tempBooking?.date === 'AWAIT_PASSCODE') {
        ctx.session.tempBooking.date = undefined;
        if (ctx.message.text === "INSTRUCTOR") {
            const telegramId = ctx.from.id;
            let user = await UserModel.findOne({ telegramId });
            if (!user) {
                user = new UserModel({
                    telegramId,
                    fullName: ctx.from.first_name,
                    phone: "N/A",
                    role: UserRole.INSTRUCTOR
                });
                await user.save();
            }

            const profile = await InstructorProfileModel.findOne({ userId: telegramId });
            if (!profile) {
                await ctx.conversation.enter("instructorSetupConversation");
            } else {
                await ctx.reply("Tizimga muvaffaqiyatli kirdingiz! (Instruktor). \nBoshqaruv uchun /admin ni bosing.");
            }
        } else {
            await ctx.reply("Maxfiy kod xato. Qayta urinib ko'ring yoki /start orqali O'quvchi sifatida kiring.");
        }
        return;
    }
    await next();
});
