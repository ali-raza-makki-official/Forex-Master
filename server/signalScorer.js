/**
 * Signal Scorer (Multi-Leader Confirmation)
 * Assigns weights to leaders and requires a threshold score to trigger.
 */

function scoreSignal(leaderMoves, dbWeights, minConfidencePct = 85) {
    let buyScore = 0;
    let sellScore = 0;
    let breakdown = {};
    let totalMaxScore = 0; // Dynamic threshold based on active pairs

    for (const [pair, data] of Object.entries(leaderMoves)) {
        const { move, correlation, weight } = data;
        
        totalMaxScore += weight * 1.5; // Theoretical max points for this pair

        // Multiplier based on strength of move (e.g. 0.05% move is a strong signal)
        const strength = Math.min(Math.abs(move) / 0.05, 1.5);
        const points = weight * strength;

        // Correlation Logic:
        // 'inverse': Pair drops -> Gold BUYS (e.g. DXY)
        // 'same': Pair rises -> Gold BUYS (e.g. Silver)
        if (correlation === 'inverse') {
            if (move < 0) buyScore += points;
            if (move > 0) sellScore += points;
        } else {
            if (move > 0) buyScore += points;
            if (move < 0) sellScore += points;
        }

        breakdown[pair] = { move: move.toFixed(4), points: points.toFixed(1), confirmed: true };
    }

    let direction = null;
    
    // Dynamic threshold: user-defined confidence level of the maximum possible points
    const confidenceRatio = minConfidencePct / 100;
    const THRESHOLD = Math.max(totalMaxScore * confidenceRatio, 10);

    if (buyScore >= THRESHOLD && buyScore > sellScore) {
        direction = 'BUY';
    } else if (sellScore >= THRESHOLD && sellScore > buyScore) {
        direction = 'SELL';
    }

    // Real-time live score tracks the highest active direction for the UI radar progress bar
    const maxRawScore = Math.max(buyScore, sellScore);
    const safeScore = Math.max(0, Math.round(maxRawScore || 0));
    const safeThreshold = Math.max(10, Math.round(THRESHOLD || 0));
    const scoreRatio = safeThreshold > 0 ? (safeScore / safeThreshold) : 0;
    const grade = direction ? (scoreRatio >= 1.2 ? 'A+' : 'B') : 'F';

    return {
        direction,
        score: safeScore,
        threshold: safeThreshold,
        action: (direction && grade !== 'F') ? 'EXECUTE' : 'IGNORE',
        breakdown,
        grade
    };
}

function getScoreDisplay(score) {
    if (score >= 100) return '🔥 STRONG';
    if (score >= 70) return '✅ GOOD';
    return '⚠️ WEAK';
}

module.exports = { scoreSignal, getScoreDisplay };
