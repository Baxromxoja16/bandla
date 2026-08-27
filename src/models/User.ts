import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    telegramId: number;
    fullName: string;
    phone: string;
    isBlacklisted: boolean;
    createdAt: Date;
}

const UserSchema = new Schema<IUser>({
    telegramId: { type: Number, required: true, unique: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    isBlacklisted: { type: Boolean, default: false }
}, {
    timestamps: { createdAt: true, updatedAt: false }
});

export const User = mongoose.model<IUser>('User', UserSchema);
