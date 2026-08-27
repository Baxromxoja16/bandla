import mongoose, { Schema, Document } from 'mongoose';

export enum BookingStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    CANCELLED = "CANCELLED"
}

export interface IBooking extends Document {
    userId: number; // References User.telegramId
    date: string; // Format: "YYYY-MM-DD"
    startTime: string; // Format: "HH:mm"
    endTime: string; // Format: "HH:mm"
    durationMinutes: number; // 30, 60, 90, 120, 150, 180
    status: BookingStatus;
    createdAt: Date;
}

const BookingSchema = new Schema<IBooking>({
    userId: { type: Number, required: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    status: { type: String, enum: Object.values(BookingStatus), default: BookingStatus.PENDING }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

BookingSchema.index({ date: 1, startTime: 1 });
BookingSchema.index({ userId: 1 });

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
