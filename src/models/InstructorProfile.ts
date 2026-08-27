import { Schema, model, Document } from "mongoose";

export interface IInstructorProfile extends Document {
    userId: number; // User.telegramId
    carModel: string; // masalan: "Gentra"
    carNumber: string; // masalan: "01 A 777 AA"
    transmission: "MANUAL" | "AUTOMATIC"; // Mexanika / Avtomat
    isAvailable: boolean; // default: true (Vaqtincha qabulni to'xtatish uchun)
}

const InstructorProfileSchema = new Schema<IInstructorProfile>({
    userId: { type: Number, required: true, unique: true },
    carModel: { type: String, required: true },
    carNumber: { type: String, required: true },
    transmission: { type: String, enum: ["MANUAL", "AUTOMATIC"], required: true },
    isAvailable: { type: Boolean, default: true }
});

export const InstructorProfileModel = model<IInstructorProfile>("InstructorProfile", InstructorProfileSchema);
