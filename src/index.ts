import { run } from '@grammyjs/runner';
import express from 'express';
import { connectDB } from './config/db.js';
import { bot } from './bot.js';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;

// Render portini tinglash uchun oddiy HTTP route
app.get('/', (req, res) => {
    res.send('Bot is active and running!');
});

// Ping uchun maxsus endpoint
app.get('/ping', (req, res) => {
    console.log('🔄 Self-ping request received to keep-alive!');
    res.status(200).send('PONG');
});

const start = async () => {
    try {
        await connectDB();

        console.log('Starting bot...');
        const runner = run(bot);

        // Express serverni ishga tushirish (Render port xatosini yechadi)
        app.listen(PORT, () => {
            console.log(`🌐 Express HTTP server running on port ${PORT}`);
            
            // Har 14 daqiqada o'ziga-o'zi so'rov yuborish (Render Sleep bo'lib qolmasligi uchun)
            if (RENDER_EXTERNAL_URL) {
                const FOURTEEN_MINUTES = 14 * 60 * 1000;
                setInterval(async () => {
                    try {
                        const pingUrl = `${RENDER_EXTERNAL_URL}/ping`;
                        await fetch(pingUrl);
                        console.log(`📡 Keep-alive ping sent to ${pingUrl}`);
                    } catch (err: any) {
                        console.error('❌ Keep-alive ping failed:', err.message);
                    }
                }, FOURTEEN_MINUTES);
            } else {
                console.warn('⚠️ RENDER_EXTERNAL_URL environment variable is not defined.');
            }
        });

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