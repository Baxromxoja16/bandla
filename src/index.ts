import { run } from '@grammyjs/runner';
import { connectDB } from './config/db.js';
import { bot } from './bot.js';
import 'dotenv/config';

const start = async () => {
    try {
        await connectDB();

        console.log('Starting bot...');

        const runner = run(bot);

        const stopRunner = () => {
            console.log('Stopping bot...');
            runner.isRunning() && runner.stop();
            process.exit(0);
        };

        process.once('SIGINT', stopRunner);
        process.once('SIGTERM', stopRunner);

        console.log('✅ Bot is up and running!');
    } catch (error) {
        console.error('Failed to start application:', error);
        process.exit(1);
    }
};

start();
