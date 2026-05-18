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
    
    // Dynamic threshold: user-defined confidence level of sessional contribution.
    // To prevent the "dilution effect" where adding more minor lagging assets inflates the threshold and blocks trading,
    // we base the target maximum score on the top 3 highest-weighted leaders.
    const sortedWeights = Object.values(leaderMoves).map(d => d.weight).sort((a, b) => b - a);
    const topWeightsSum = sortedWeights.slice(0, 3).reduce((a, b) => a + b, 0);
    const targetBaseScore = topWeightsSum * 1.35; // Optimal target points based on top 3 main leaders
    
    const confidenceRatio = minConfidencePct / 100;
    const THRESHOLD = Math.max(targetBaseScore * confidenceRatio, 10);

    const maxRawScore = Math.max(buyScore, sellScore);
    if (maxRawScore > 0) {
        if (buyScore > sellScore) {
            direction = 'BUY';
        } else if (sellScore > buyScore) {
            direction = 'SELL';
        }
    }

    const safeScore = Math.max(0, Math.round(maxRawScore || 0));
    const safeThreshold = Math.max(10, Math.round(THRESHOLD || 0));
    const scoreRatio = safeThreshold > 0 ? (safeScore / safeThreshold) : 0;
    
    // An execute signal is one that meets or exceeds the threshold
    const isAboveThreshold = direction && (
        (direction === 'BUY' && buyScore >= THRESHOLD) ||
        (direction === 'SELL' && sellScore >= THRESHOLD)
    );

    const grade = isAboveThreshold ? (scoreRatio >= 1.2 ? 'A+' : 'B') : 'F';
    const action = isAboveThreshold ? 'EXECUTE' : 'IGNORE';

    return {
        direction,
        score: safeScore,
        threshold: safeThreshold,
        action: action,
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
