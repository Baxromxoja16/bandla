import { Context, SessionFlavor } from "grammy";

export interface SessionData {
    tempBooking?: {
        instructorId?: number;
        date?: string;
        startTime?: string;
        durationMinutes?: number;
    };
}

export type MyContext = Context & SessionFlavor<SessionData> & any;
