import { Schema, model, Document } from "mongoose";

export enum BookingStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    CANCELLED = "CANCELLED"
}

export interface IBooking extends Document {
    studentId: number;
    instructorId: number;
    date: string; // "YYYY-MM-DD"
    startTime: string; // "14:00"
    endTime: string; // "15:30"
    durationMinutes: number; // 30, 60, 90, 120, 150, 180
    status: BookingStatus;
    createdAt: Date;
}

const BookingSchema = new Schema<IBooking>({
    studentId: { type: Number, required: true },
    instructorId: { type: Number, required: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    status: { type: String, enum: Object.values(BookingStatus), default: BookingStatus.PENDING },
    createdAt: { type: Date, default: Date.now }
});

BookingSchema.index({ instructorId: 1, date: 1 });
BookingSchema.index({ studentId: 1 });

export const BookingModel = model<IBooking>("Booking", BookingSchema);
