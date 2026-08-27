import { InlineKeyboard } from 'grammy';

export const getAdminBookingActionKeyboard = (bookingId: string) => {
    return new InlineKeyboard()
        .text('✅ Tasdiqlash', `admin_approve_${bookingId}`)
        .text('❌ Rad etish', `admin_reject_${bookingId}`).row()
        .text('🚫 Qora ro\'yxatga olish', `admin_blacklist_${bookingId}`);
};

export const getAdminDateKeyboard = () => {
    const keyboard = new InlineKeyboard();
    let added = 0;
    const now = new Date();

    for (let i = 0; added < 6; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        if (d.getDay() !== 0) {
            const dateStr = d.toISOString().split('T')[0];
            const days = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan'];
            const displayStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')} (${days[d.getDay()]})`;

            keyboard.text(displayStr, `admin_date_${dateStr}`).row();
            added++;
        }
    }
    return keyboard;
};
