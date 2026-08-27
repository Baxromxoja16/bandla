import { Context, SessionFlavor } from 'grammy';

export interface SessionData {
    tempBooking?: {
        date?: string;
        startTime?: string;
        durationMinutes?: number;
    };
}

export type MyContext = Context & SessionFlavor<SessionData>;
