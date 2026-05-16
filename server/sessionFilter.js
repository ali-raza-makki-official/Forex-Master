const { getNewsStatus } = require('./newsFilter');

/**
 * Session Filter
 * Ensures trading only happens during high-liquidity sessions.
 * London: 07:00 - 12:00 UTC
 * New York: 13:00 - 18:00 UTC
 */

function isSessionActive() {
    const now = new Date();
    const hour = now.getUTCHours();
    
    const isLondon = (hour >= 7 && hour < 12);
    const isNewYork = (hour >= 13 && hour < 18);
    
    // We also allow overlap and 1 hour before/after for transition
    return isLondon || isNewYork;
}

function getActiveSessionName() {
    const hour = new Date().getUTCHours();
    if (hour >= 7 && hour < 12) return "LONDON";
    if (hour >= 13 && hour < 18) return "NEW YORK";
    if (hour >= 12 && hour < 13) return "SESSION OVERLAP";
    return "ASIAN / QUIET";
}

async function getSessionStatus() {
    const hour = new Date().getUTCHours();
    let session = "ASIAN / QUIET";
    if (hour >= 7 && hour < 12) session = "LONDON";
    else if (hour >= 13 && hour < 18) session = "NEW YORK";
    else if (hour >= 12 && hour < 13) session = "SESSION OVERLAP";

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
