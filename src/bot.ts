import { Bot, session } from "grammy";
import { conversations } from "@grammyjs/conversations";
import { hydrate } from "@grammyjs/hydrate";
import { MyContext, SessionData } from "./bot.types.js";
import { authComposer } from "./handlers/authHandler.js";
import { studentComposer } from "./handlers/studentHandler.js";
import { instructorComposer } from "./handlers/instructorHandler.js";
import { myBookingsComposer } from "./handlers/myBookingsHandler.js";
import "dotenv/config";

if (!process.env.BOT_TOKEN) {
    throw new Error("BOT_TOKEN is missing in .env");
}

export const bot = new Bot<MyContext>(process.env.BOT_TOKEN);

bot.use(hydrate());

bot.use(session({
    initial: (): SessionData => ({ tempBooking: {} }),
}));

bot.use(conversations());

bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
});

bot.use(authComposer);
bot.use(studentComposer);
bot.use(instructorComposer);
bot.use(myBookingsComposer);
