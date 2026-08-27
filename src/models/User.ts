import { Schema, model, Document } from "mongoose";

export enum UserRole {
    STUDENT = "STUDENT",
    INSTRUCTOR = "INSTRUCTOR"
}

export interface IUser extends Document {
    telegramId: number;
    fullName: string;
    phone: string;
    role: UserRole;
    createdAt: Date;
}

const UserSchema = new Schema<IUser>({
    telegramId: { type: Number, required: true, unique: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.STUDENT },
    createdAt: { type: Date, default: Date.now }
});

export const UserModel = model<IUser>("User", UserSchema);
