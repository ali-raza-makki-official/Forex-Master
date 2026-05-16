const cron = require('node-cron');
const fetch = require('node-fetch');

/**
 * News Filter Engine
 * Fetches High-Impact economic news for USD and Gold.
 * Blocks the engine 10 mins before and after high-impact events.
 */

let newsBlockActive = false;
let currentEvent = null;
let nextNewsMs = null;
let nextNewsName = null;

async function fetchEconomicCalendar() {
    try {
        const response = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json');
        const data = await response.json();
        
        const now = new Date();
        const dangerZoneMins = 10;
        
        // Reset before check
        newsBlockActive = false;
        currentEvent = null;

        const highImpactEvents = data.filter(e => 
            (e.country === 'USD') && 
            (e.impact === 'High')
        );

        let minNextMs = null;
        let minEventTitle = null;

        highImpactEvents.forEach(event => {
            const eventTime = new Date(event.date);
            const diffMins = (eventTime - now) / (1000 * 60);

            // Block if within the danger zone
            if (diffMins > -dangerZoneMins && diffMins < dangerZoneMins) {
                newsBlockActive = true;
                currentEvent = event.title;
            }

            // Track next upcoming event
            if (eventTime > now) {
                if (minNextMs === null || eventTime < minNextMs) {
                    minNextMs = eventTime.getTime();
                    minEventTitle = event.title;
                }
            }
        });

        nextNewsMs = minNextMs;
        nextNewsName = minEventTitle;

        if (newsBlockActive) {
            console.log(`[NEWS FILTER] Engine Blocked due to: ${currentEvent}`);
        } else {
            console.log(`[NEWS FILTER] Market Clean. Next High-Impact: ${nextNewsName || 'None'}`);
        }
    } catch (e) {
        console.error('[NEWS FILTER] Error fetching calendar:', e.message);
    }
}

// Check calendar every 15 minutes
cron.schedule('*/15 * * * *', fetchEconomicCalendar);

// Initial fetch
fetchEconomicCalendar();

/**
 * Returns current news status.
 * Includes auto-reset logic if an event has just passed to prevent permanent blocks.
 */
async function getNewsStatus() {
    const now = Date.now();
    const bufferMs = 10 * 60 * 1000; // 10 mins

    // Auto-reset if the last known news event has already passed its danger zone
    if (newsBlockActive && currentEvent) {
        // If we have a nextNewsMs that was the cause of the block, and it's now in the past
        if (nextNewsMs && now > (nextNewsMs + bufferMs)) {
            console.log(`[NEWS FILTER] Auto-resetting block. Event ${currentEvent} passed.`);
            newsBlockActive = false;
            currentEvent = null;
        }
    }

    return { 
        isActive: newsBlockActive, 
        event: currentEvent,
        nextNewsMs: nextNewsMs,
        nextNewsName: nextNewsName
    };
}

module.exports = { getNewsStatus };
