import { IBooking, BookingStatus } from '../models/Booking.js';

export const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

export const minutesToTime = (mins: number): string => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const isOverlap = (startA: number, endA: number, startB: number, endB: number): boolean => {
    return (startA < endB) && (endA > startB);
};

export const calculateAvailableSlots = (date: string, existingBookings: IBooking[]): string[] => {
    const slots: string[] = [];
    const activeBookings = existingBookings.filter(b => b.status === BookingStatus.APPROVED || b.status === BookingStatus.PENDING);

    // 06:00 to 19:30, since day ends at 20:00 and min duration is 30m.
    for (let current = 360; current < 1200; current += 30) {
        // Skip lunch 12:00 to 13:00 (720 to 780).
        if (current >= 720 && current < 780) {
            continue;
        }

        const currentStr = minutesToTime(current);
        const isOccupied = activeBookings.some(booking => {
            const bStart = timeToMinutes(booking.startTime);
            const bEnd = timeToMinutes(booking.endTime);
            return isOverlap(current, current + 30, bStart, bEnd);
        });

        slots.push(isOccupied ? `${currentStr} ❌` : `${currentStr} 🟢`);
    }

    return slots;
};

export const calculateSmartDurations = (startTime: string, date: string, existingBookings: IBooking[]): number[] => {
    const startMins = timeToMinutes(startTime);
    const lunchStart = 720; // 12:00
    const dayEnd = 1200; // 20:00

    let constraintA = Infinity;
    if (startMins < lunchStart) {
        constraintA = lunchStart - startMins;
    }

    const constraintB = dayEnd - startMins;

    let constraintC = Infinity;
    const activeBookings = existingBookings.filter(b => b.status === BookingStatus.APPROVED || b.status === BookingStatus.PENDING);

    for (const booking of activeBookings) {
        const bStart = timeToMinutes(booking.startTime);
        if (bStart >= startMins) {
            const diff = bStart - startMins;
            if (diff < constraintC) {
                constraintC = diff;
            }
        }
    }

    const maxAvailableMinutes = Math.min(constraintA, constraintB, constraintC, 180);

    const possibleDurations = [30, 60, 90, 120, 150, 180];
    return possibleDurations.filter(d => d <= maxAvailableMinutes);
};
