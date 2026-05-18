// server/whatsappAlert.js
const https = require('https');

const ENABLED = process.env.WHATSAPP_ENABLED === 'true';
const PHONE = process.env.WHATSAPP_PHONE;
const APIKEY = process.env.WHATSAPP_APIKEY;

async function sendWhatsAppMessage(text) {
    if (!ENABLED || !PHONE || !APIKEY) {
        return; // WhatsApp notifications disabled or not configured
    }

    // CallMeBot API format:
    // https://api.callmebot.com/whatsapp.php?phone=[phone]&text=[text]&apikey=[apikey]
    const encodedText = encodeURIComponent(text);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${PHONE}&text=${encodedText}&apikey=${APIKEY}`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200 || data.includes("Message queued") || data.includes("sent successfully")) {
                    console.log('[WHATSAPP] Notification sent successfully!');
                    resolve(data);
                } else {
                    console.warn(`[WHATSAPP] Failed to send: HTTP ${res.statusCode}. Response: ${data}`);
                    resolve(null); // Resolve null to prevent crash
                }
            });
        }).on('error', (err) => {
            console.error('[WHATSAPP] Send error:', err.message);
            resolve(null); // Silent fail to prevent server crash during network drops
        });
    });
}

async function sendWhatsAppSignalAlert(signal, sltp, score, session) {
    const text = `🚀 *GOLD HFT SIGNAL: ${signal.type}*
━━━━━━━━━━━━━━━
💰 Price: *${signal.goldPrice}*
🎯 TP: *${signal.tp}* (${signal.tpPips} pips)
🛑 SL: *${signal.sl}* (${signal.slPips} pips)

📊 *Analysis:*
• Confidence: *${signal.confidence}%*
• Score: *${signal.score}*
• Volatility: *${signal.volatility}*
• Session: *${session.session}*

🛡️ *Safety:*
• Spread: *${signal.spread} pips*
━━━━━━━━━━━━━━━
_Auto-Scalp Engine v1.0_`;

    await sendWhatsAppMessage(text);
}

async function sendWhatsAppRiskAlert(reason, details) {
    const text = `⚠️ *RISK ALERT: ENGINE HALTED*
━━━━━━━━━━━━━━━
🛑 Reason: *${reason}*
📝 Details: ${details}
⏰ Time: ${new Date().toLocaleTimeString()}
━━━━━━━━━━━━━━━
_Check terminal for manual reset._`;

    await sendWhatsAppMessage(text);
}

module.exports = { sendWhatsAppSignalAlert, sendWhatsAppRiskAlert };
