/**
 * Risk Guard Engine
 * Tracks consecutive losses and daily drawdown.
 */

let dailyLossLimit = 50.0; // $50 Max Daily Loss
let maxConsecutiveSL = 3;

function checkRiskSafety(tradeStats, currentBalance, startOfDayBalance) {
    let isBlocked = false;
    let reason = null;

    // 1. Check Consecutive SL
    // In a production DB, we'd query the last 3 rows from trade_logs
    if (tradeStats.sl?.consecutive >= maxConsecutiveSL) {
        isBlocked = true;
        reason = "MAX CONSECUTIVE LOSS REACHED";
    }

    // 2. Check Daily Drawdown
    const currentDrawdown = startOfDayBalance - currentBalance;
    if (currentDrawdown >= dailyLossLimit) {
        isBlocked = true;
        reason = "DAILY LOSS LIMIT HIT";
    }

    return { isBlocked, reason, currentDrawdown };
}

module.exports = { checkRiskSafety };
