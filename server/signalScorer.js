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
    let finalScore = 0;
    
    // Dynamic threshold: user-defined confidence level of the maximum possible points
    const confidenceRatio = Math.max(minConfidencePct / 100, 0.4); // Minimum 40% floor
    const THRESHOLD = Math.max(totalMaxScore * confidenceRatio, 10);

    if (buyScore >= THRESHOLD && buyScore > sellScore) {
        direction = 'BUY';
        finalScore = buyScore;
    } else if (sellScore >= THRESHOLD && sellScore > buyScore) {
        direction = 'SELL';
        finalScore = sellScore;
    }

    return {
        direction,
        score: Math.round(finalScore),
        threshold: Math.round(THRESHOLD),
        action: direction ? 'EXECUTE' : 'IGNORE',
        breakdown,
        grade: finalScore >= (THRESHOLD * 1.5) ? 'A+' : (finalScore >= THRESHOLD ? 'B' : 'F')
    };
}

function getScoreDisplay(score) {
    if (score >= 100) return '🔥 STRONG';
    if (score >= 70) return '✅ GOOD';
    return '⚠️ WEAK';
}

module.exports = { scoreSignal, getScoreDisplay };
