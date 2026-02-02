// PaymentService.js - Distance/payment calculations

import { DISTANCE_ATTRIBUTES } from '../config.js';

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

// Calculate payment based on distance: 30 * 1.1^(-distance^1.2)
// Close match = more money, far match = less money
export function calculatePayment(distance) {
    const payment = 30 * Math.pow(1.1, -Math.pow(distance, 1.2));
    return Math.max(0, Math.round(payment * 100) / 100); // Round to cents, min $0
}

// Get satisfaction rating based on distance
export function getSatisfactionRating(distance) {
    if (distance <= 2) return { rating: "PERFECT", emoji: "★★★★★", color: "#ffff00" };
    if (distance <= 5) return { rating: "EXCELLENT", emoji: "★★★★☆", color: "#33ff33" };
    if (distance <= 8) return { rating: "GOOD", emoji: "★★★☆☆", color: "#33ff33" };
    if (distance <= 11) return { rating: "OKAY", emoji: "★★☆☆☆", color: "#aaffaa" };
    if (distance <= 14) return { rating: "POOR", emoji: "★☆☆☆☆", color: "#ffaa00" };
    return { rating: "TERRIBLE", emoji: "☆☆☆☆☆", color: "#ff3333" };
}
