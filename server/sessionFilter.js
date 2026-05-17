const { getNewsStatus } = require('./newsFilter');

/**
 * Session Filter
 * Ensures trading only happens during high-liquidity sessions.
 * London: 07:00 - 15:00 UTC
 * New York: 13:00 - 21:00 UTC
 * Overlap: 13:00 - 15:00 UTC
 */

function isSessionActive() {
    const hour = new Date().getUTCHours();
    // Allow trading during London and New York sessional hours
    return hour >= 7 && hour < 21;
}

function getActiveSessionName() {
    const hour = new Date().getUTCHours();
    if (hour >= 13 && hour < 15) return "LDN / NY OVERLAP";
    if (hour >= 7 && hour < 13) return "LONDON";
    if (hour >= 15 && hour < 21) return "NEW YORK";
    return "ASIAN / QUIET";
}

async function getSessionStatus() {
    const hour = new Date().getUTCHours();
    let session = "ASIAN / QUIET";
    if (hour >= 13 && hour < 15) session = "LDN / NY OVERLAP";
    else if (hour >= 7 && hour < 13) session = "LONDON";
    else if (hour >= 15 && hour < 21) session = "NEW YORK";

    const news = await getNewsStatus();
    
    return {
        session,
        allowed: isSessionActive() && !news.isActive,
        nextNewsMs: news.nextNewsMs,
        nextNewsName: news.nextNewsName,
        isNewsActive: news.isActive,
        newsWarn: news.event ? `${news.event} active` : (news.nextNewsName ? `${news.nextNewsName} soon` : null)
    };
}

module.exports = { isSessionActive, getActiveSessionName, getSessionStatus };
