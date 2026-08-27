import { Bot, session } from 'grammy';
import { MyContext, SessionData } from './bot.types.js';
import { startComposer } from './handlers/startHandler.js';
import { bookingComposer } from './handlers/bookingHandler.js';
import { myBookingsComposer } from './handlers/myBookingsHandler.js';
import { adminComposer } from './handlers/adminHandler.js';
import 'dotenv/config';

if (!process.env.BOT_TOKEN) {
    throw new Error('BOT_TOKEN is missing in .env');
}

export const bot = new Bot<MyContext>(process.env.BOT_TOKEN);

bot.use(session({
    initial: (): SessionData => ({ tempBooking: {} }),
}));

bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
});

bot.use(startComposer);
bot.use(bookingComposer);
bot.use(myBookingsComposer);
bot.use(adminComposer);
