import { InlineKeyboard } from 'grammy';
import { IBooking } from '../models/Booking.js';
import { IInstructorProfile } from '../models/InstructorProfile.js';
import { calculateAvailableSlots, calculateSmartDurations } from '../utils/timeHelpers.js';

export const getInstructorsKeyboard = (instructors: (IInstructorProfile & { fullName: string })[]) => {
    const keyboard = new InlineKeyboard();
    instructors.forEach(inst => {
        const transText = inst.transmission === 'MANUAL' ? '🕹 Mexanika' : '🅰️ Avtomat';
        const label = `🏎 ${inst.fullName} | ${inst.carModel} (${transText})`;
        keyboard.text(label, `select_inst_${inst.userId}`).row();
    });
    return keyboard;
};

export const getDatesKeyboard = () => {
    const keyboard = new InlineKeyboard();
    let added = 0;
    const now = new Date();

    for (let i = 0; added < 6; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        if (d.getDay() !== 0) {
            const dateStr = d.toISOString().split('T')[0];
            const days = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
            const displayStr = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')} (${days[d.getDay()]})`;

            keyboard.text(displayStr, `date_${dateStr}`).row();
            added++;
        }
    }
    keyboard.text("🔙 Orqaga", "back_to_instructors");
    return keyboard;
};

export const getTimeGridKeyboard = (date: string, existingBookings: IBooking[]) => {
    const slots = calculateAvailableSlots(date, existingBookings);
    const keyboard = new InlineKeyboard();

    for (let i = 0; i < slots.length; i += 3) {
        const rowItems = slots.slice(i, i + 3);
        rowItems.forEach(slot => {
            const time = slot.split(' ')[0];
            const isAvailable = slot.includes('🟢');
            const callbackData = isAvailable ? `time_${date}_${time}` : 'noop';
            keyboard.text(slot, callbackData);
        });
        keyboard.row();
    }

    keyboard.text('🔙 Orqaga', 'back_to_dates');
    return keyboard;
};

export const getSmartDurationsKeyboard = (startTime: string, date: string, existingBookings: IBooking[]) => {
    const durations = calculateSmartDurations(startTime, date, existingBookings);
    const keyboard = new InlineKeyboard();

    const formatDuration = (mins: number) => {
        if (mins === 30) return '30 min';
        return `${mins / 60} soat`;
    };

    durations.forEach(d => {
        keyboard.text(formatDuration(d), `duration_${d}`).row();
    });

    keyboard.text('🔙 Orqaga', `date_${date}`);
    return keyboard;
};

export const getConfirmationKeyboard = () => {
    return new InlineKeyboard()
        .text('✅ Tasdiqlash va Yuborish', `confirm_booking`)
        .text('❌ Bekor qilish', 'cancel_booking');
};
