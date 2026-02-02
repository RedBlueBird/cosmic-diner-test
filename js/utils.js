import { DISTANCE_ATTRIBUTES, ATTR_DESCRIPTIONS } from './config.js';

// Food data (loaded from JSON)
let RECIPES = {};
let MUTATIONS = {};
let AMPLIFICATIONS = {};
let ATOMS = [];
let DEFAULT_ATTRIBUTES = {};
let FOOD_ATTRIBUTES = {};
let TASTE_FEEDBACK = {};
let CUSTOMER_TYPES = [];

// Helper to create food attributes with defaults
export function createFoodAttr(overrides) {
    return { ...DEFAULT_ATTRIBUTES, ...overrides };
}

// Load food data from JSON file
export async function loadFoodData() {
    try {
        const response = await fetch('data/food-data.json');
        const data = await response.json();

        // Load base data
        RECIPES = data.recipes;
        MUTATIONS = data.mutations;
        AMPLIFICATIONS = data.amplifications;
        ATOMS = data.atoms;
        DEFAULT_ATTRIBUTES = data.defaultAttributes;

        // Build FOOD_ATTRIBUTES by applying defaults to each food's overrides
        FOOD_ATTRIBUTES = {};
        for (const [foodName, overrides] of Object.entries(data.foodAttributes)) {
            FOOD_ATTRIBUTES[foodName] = createFoodAttr(overrides);
        }

        // Merge mutations and amplifications into RECIPES for backward compatibility
        Object.assign(RECIPES, MUTATIONS);
        Object.assign(RECIPES, AMPLIFICATIONS);

        console.log('Food data loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load food data:', error);
        return false;
    }
}

// Load taste feedback data from JSON
export async function loadTasteFeedback() {
    try {
        const response = await fetch('data/taste-feedback.json');
        TASTE_FEEDBACK = await response.json();
        console.log('Taste feedback loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load taste feedback:', error);
        return false;
    }
}

// Load customer types from JSON
export async function loadCustomers() {
    try {
        const response = await fetch('data/customers.json');
        CUSTOMER_TYPES = await response.json();
        console.log('Customer data loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load customer data:', error);
        return false;
    }
}

// Getters for loaded data
export function getRecipes() { return RECIPES; }
export function getAtoms() { return ATOMS; }
export function getCustomerTypes() { return CUSTOMER_TYPES; }

// Get attributes for any food item (with fallback for unknown items)
export function getFoodAttributes(itemName) {
    if (FOOD_ATTRIBUTES[itemName]) {
        return FOOD_ATTRIBUTES[itemName];
    }
    // Fallback for dynamically created items (like "Hot X")
    if (itemName.startsWith("Hot ")) {
        const baseItem = itemName.substring(4);
        if (FOOD_ATTRIBUTES[baseItem]) {
            return { ...FOOD_ATTRIBUTES[baseItem], temperature: 8 };
        }
    }
    // Ultimate fallback - mysterious unknown food
    return createFoodAttr({
        sanity: -1, health: 2, filling: 3,
    });
}

// Get feedback message for an attribute value
export function getTasteFeedback(attribute, value) {
    const ranges = TASTE_FEEDBACK[attribute];
    if (!ranges) return null;

    for (const range of ranges) {
        if (value >= range.min && value <= range.max) {
            return range.msg;
        }
    }
    return null;
}

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

// Calculate payment based on distance: 20 * 1.3^(-distance)
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
