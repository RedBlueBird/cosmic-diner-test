// FeedbackService.js - Taste feedback and demand hints

import { getTasteFeedbackData } from '../data/DataStore.js';
import { ATTR_DESCRIPTIONS } from '../config.js';

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
            } else if (val >= 5) {
                hints.push(desc.toUpperCase());
            } else if (val >= 3) {
                hints.push(desc);
            }
        }
    }

    return hints.length > 0 ? hints.join(", ") : "???";
}
