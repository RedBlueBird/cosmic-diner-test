// FeedbackService.js - Taste feedback and demand hints

import { getTasteFeedbackData } from '../data/DataStore.js';
import { ATTR_DESCRIPTIONS, DEMAND_HINT_STRONG_THRESHOLD, DEMAND_HINT_MODERATE_THRESHOLD } from '../config.js';

// Get feedback message for an attribute value
export function getTasteFeedback(attribute, value) {
    const TASTE_FEEDBACK = getTasteFeedbackData();
    const ranges = TASTE_FEEDBACK[attribute];
    if (!ranges) return null;

    for (const range of ranges) {
        if (value >= range.min && value <= range.max) {
            return range.msg;
        }
    }
    return null;
}

// Generate readable hints from demand vector
export function getDemandHints(demand) {
    const hints = [];

    for (const [attr, val] of Object.entries(demand)) {
        const desc = ATTR_DESCRIPTIONS[attr];
        if (desc) {
            if (typeof desc === 'function') {
                const result = desc(val);
                if (result) hints.push(result);
            } else if (val >= DEMAND_HINT_STRONG_THRESHOLD) {
                hints.push(desc.toUpperCase());
            } else if (val >= DEMAND_HINT_MODERATE_THRESHOLD) {
                hints.push(desc);
            }
        }
    }

    return hints.length > 0 ? hints.join(", ") : "???";
}
