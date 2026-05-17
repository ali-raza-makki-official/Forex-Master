const TelegramBot = require('node-telegram-bot-api');

/**
 * Telegram Alert System
 * Sends signals and risk alerts to your phone.
 * Supports dynamic database settings configuration.
 */

const TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_BOT_TOKEN';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID';

let bot = null;

function initTelegram() {
    if (TOKEN === 'YOUR_BOT_TOKEN') {
        console.log('[TELEGRAM] Static token not set. Awaiting dynamic database setup.');
        return;
    }
    try {
        bot = new TelegramBot(TOKEN, { polling: false });
        console.log('[TELEGRAM] Static alert system initialized.');
    } catch(e) {
        console.error('[TELEGRAM] Initialization error:', e.message);
    }
}

async function getActiveBotInstance(db) {
    try {
        if (db) {
            const settings = await db.getSystemSettings();
            const token = settings?.telegram_token || TOKEN;
            const chatId = settings?.telegram_chat_id || CHAT_ID;
            
            if (token && token !== 'YOUR_BOT_TOKEN' && chatId && chatId !== 'YOUR_CHAT_ID') {
                return {
                    botInstance: new TelegramBot(token, { polling: false }),
                    chatId: chatId
                };
            }
        }
    } catch(e) {
        console.error('[TELEGRAM] Error fetching database configurations:', e.message);
    }
    
    if (bot && CHAT_ID !== 'YOUR_CHAT_ID') {
        return { botInstance: bot, chatId: CHAT_ID };
    }
    return null;
}

async function sendSignalAlert(signal, sltp, score, session, db) {
    const active = await getActiveBotInstance(db);
    if (!active) return;

    const { botInstance, chatId } = active;

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
        await botInstance.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log('[TELEGRAM] Signal alert sent successfully.');
    } catch (e) {
        console.error('[TELEGRAM] Send error:', e.message);
    }
}

async function sendRiskAlert(reason, details, db) {
    const active = await getActiveBotInstance(db);
    if (!active) return;

    const { botInstance, chatId } = active;

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
        await botInstance.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        console.log('[TELEGRAM] Risk alert sent successfully.');
    } catch (e) {
        console.error('[TELEGRAM] Risk alert error:', e.message);
    }
}

module.exports = { initTelegram, sendSignalAlert, sendRiskAlert };
