import { Composer, Keyboard } from 'grammy';
import { MyContext } from '../bot.types.js';
import { User } from '../models/User.js';

export const startComposer = new Composer<MyContext>();

startComposer.command('start', async (ctx) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return;

    const user = await User.findOne({ telegramId });
    if (user) {
        return ctx.reply(`Assalomu alaykum xush kelibsiz, ${user.fullName}! \n\nBron qilish uchun /book buyrug'ini yuboring. O'z bronlaringizni ko'rish uchun /my_bookings buyrug'ini yuboring.`);
    }

    const contactKeyboard = new Keyboard()
        .requestContact('📞 Kontaktni yuborish')
        .resized()
        .oneTime();

    await ctx.reply("Assalomu alaykum! Iltimos, ro'yxatdan o'tish uchun quyidagi tugmani bosib telefon raqamingizni yuboring:", {
        reply_markup: contactKeyboard,
    });
});

startComposer.on('message:contact', async (ctx) => {
    const contact = ctx.message.contact;
    const telegramId = ctx.from?.id;

    if (!telegramId || !contact || contact.user_id !== telegramId) {
        return ctx.reply("Iltimos, o'zingizning kontakt ma'lumotingizni yuboring!");
    }

    let user = await User.findOne({ telegramId });
    if (!user) {
        user = new User({
            telegramId,
            fullName: `${contact.first_name} ${contact.last_name || ''}`.trim(),
            phone: contact.phone_number
        });
        await user.save();
        await ctx.reply("Ro'yxatdan muvaffaqiyatli o'tdingiz! 🎉\nEndi dars bron qilish uchun /book ni bosing.", {
            reply_markup: { remove_keyboard: true }
        });
    }
});
