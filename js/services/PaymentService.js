// PaymentService.js - Distance/payment calculations

import { DISTANCE_ATTRIBUTES, PAYMENT_BASE, PAYMENT_DECAY_BASE, PAYMENT_DISTANCE_EXPONENT, SATISFACTION_THRESHOLDS } from '../config.js';

// Calculate Euclidean distance between food attributes and customer demand
export function calculateDistance(foodAttrs, demandVector) {
    let sumSquares = 0;

    for (const attr of DISTANCE_ATTRIBUTES) {
        const foodVal = foodAttrs[attr] || 0;
        const demandVal = demandVector[attr];

        // Skip attributes not specified in demand (undefined = don't care)
        if (demandVal === undefined) continue;

        const diff = foodVal - demandVal;
        sumSquares += diff * diff;
    }

    return Math.sqrt(sumSquares);
}

// Calculate payment based on distance
// Close match = more money, far match = less money
export function calculatePayment(distance) {
    const payment = PAYMENT_BASE * Math.pow(PAYMENT_DECAY_BASE, -Math.pow(distance, PAYMENT_DISTANCE_EXPONENT));
    return Math.max(0, Math.round(payment * 100) / 100); // Round to cents, min $0
}

// Satisfaction rating definitions (matched by SATISFACTION_THRESHOLDS)
const RATINGS = [
    { rating: "PERFECT", emoji: "★★★★★", color: "#ffff00" },
    { rating: "EXCELLENT", emoji: "★★★★☆", color: "#33ff33" },
    { rating: "GOOD", emoji: "★★★☆☆", color: "#33ff33" },
    { rating: "OKAY", emoji: "★★☆☆☆", color: "#aaffaa" },
    { rating: "POOR", emoji: "★☆☆☆☆", color: "#ffaa00" },
];
const TERRIBLE_RATING = { rating: "TERRIBLE", emoji: "☆☆☆☆☆", color: "#ff3333" };

// Get satisfaction rating based on distance
export function getSatisfactionRating(distance) {
    for (let i = 0; i < SATISFACTION_THRESHOLDS.length; i++) {
        if (distance <= SATISFACTION_THRESHOLDS[i]) return RATINGS[i];
    }
    return TERRIBLE_RATING;
}
