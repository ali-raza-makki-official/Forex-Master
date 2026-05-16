const TelegramBot = require('node-telegram-bot-api');

/**
 * Telegram Alert System
 * Sends signals and risk alerts to your phone.
 */

// These should ideally be in your .env.local file
const TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_BOT_TOKEN';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID';

let bot = null;

function initTelegram() {
    if (TOKEN === 'YOUR_BOT_TOKEN') {
        console.log('[TELEGRAM] Token not set, alerts disabled.');
        return;
    }
    bot = new TelegramBot(TOKEN, { polling: false });
    console.log('[TELEGRAM] Alert system initialized.');
}

async function sendSignalAlert(signal, sltp, score, session) {
    if (!bot) return;

    const message = `
🚀 *GOLD HFT SIGNAL: ${signal.type}*
━━━━━━━━━━━━━━━
💰 Price: \`${signal.goldPrice}\`
🎯 TP: \`${signal.tp}\` (${signal.tpPips} pips)
🛑 SL: \`${signal.sl}\` (${signal.slPips} pips)

📊 *Analysis:*
• Confidence: \`${signal.confidence}%\`
• Score: \`${signal.score}\`
• Volatility: \`${signal.volatility}\`
• Session: \`${session.session}\`

🛡️ *Safety:*
• Spread: \`${signal.spread} pips\`
━━━━━━━━━━━━━━━
_Auto-Scalp Engine v1.0_
    `;

    try {
        await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('[TELEGRAM] Send error:', e.message);
    }
}

async function sendRiskAlert(reason, details) {
    if (!bot) return;

    const message = `
⚠️ *RISK ALERT: ENGINE HALTED*
━━━━━━━━━━━━━━━
🛑 Reason: *${reason}*
📝 Details: ${details}
⏰ Time: ${new Date().toLocaleTimeString()}
━━━━━━━━━━━━━━━
_Check terminal for manual reset._
    `;

    try {
        await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('[TELEGRAM] Risk alert error:', e.message);
    }
}

module.exports = { initTelegram, sendSignalAlert, sendRiskAlert };
