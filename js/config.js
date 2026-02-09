// Game configuration constants

// Starting values
export const STARTING_MONEY = 30;
export const STARTING_SANITY = 100;
export const STARTING_RENT = 30;
export const STARTING_CUSTOMERS_PER_DAY = 4;
export const STARTING_ATOM_COUNT = 6;

// Defaults (when no artifact modifies them)
export const DEFAULT_MAX_SANITY = 100;
export const DEFAULT_COUNTERTOP_CAPACITY = 8;

// Day progression
export const CUSTOMERS_PER_DAY = 5;       // Day 2+ customer count
export const RENT_MULTIPLIER = 1.333;     // Rent increase per day
export const END_OF_DAY_SANITY_RESTORE = 50;

// Taste test
export const TASTE_TEST_SANITY_COST = 10;

// Sanity penalties for bad service
export const TERRIBLE_SERVICE_SANITY_PENALTY = 15;
export const POOR_SERVICE_SANITY_PENALTY = 5;

// Gordon G boss
export const GORDON_BOSS_DAY = 5;
export const GORDON_BASE_BONUS = 25;
export const GORDON_VICTORY_BONUS = 50;
export const GORDON_PERFECT_DISTANCE = 3;
export const GORDON_EXCELLENT_DISTANCE = 5;
export const GORDON_PERFECT_BONUS = 15;
export const GORDON_EXCELLENT_BONUS = 10;
export const GORDON_ACCEPTABLE_BONUS = 5;

// Divine intervention (softlock prevention)
export const DIVINE_INTERVENTION_SANITY_RATE = 0.2;

// Merchant system
export const MERCHANT_CONSUMABLE_BASE_PRICES = { common: 5, uncommon: 8, rare: 12, legendary: 20 };
export const MERCHANT_FOOD_BASE_PRICE = 15;
export const MERCHANT_BASE_USAGE_COST = 2;
export const MERCHANT_CONSUMABLE_PRICE_MULTIPLIER = 1.2;
export const MERCHANT_FOOD_PRICE_MULTIPLIER = 1.2;
export const MERCHANT_START_DAY = 2;
export const MERCHANT_STOCK_COUNT = 3;

// Payment formula: PAYMENT_BASE * PAYMENT_DECAY_BASE ^ (-distance ^ PAYMENT_DISTANCE_EXPONENT)
export const PAYMENT_BASE = 30;
export const PAYMENT_DECAY_BASE = 1.1;
export const PAYMENT_DISTANCE_EXPONENT = 1.2;

// Satisfaction distance thresholds: PERFECT, EXCELLENT, GOOD, OKAY, POOR
export const SATISFACTION_THRESHOLDS = [2, 5, 8, 11, 14];

// Demand hint thresholds (FeedbackService)
export const DEMAND_HINT_STRONG_THRESHOLD = 5;
export const DEMAND_HINT_MODERATE_THRESHOLD = 3;

// Consumable system
export const MAX_CONSUMABLES = 5;

export const APPLIANCE_UNLOCK_DAYS = {
    fridge: 1,
    pan: 1,
    trash: 1,
    board: 2,
    amp: 3,
    micro: 4
};

// Attributes used for distance calculation (subset of all attributes)
export const DISTANCE_ATTRIBUTES = [
    'savory', 'sweet', 'salty', 'sour', 'bitter', 'spicy',
    'temperature', 'moisture', 'grease', 'crunch', 'chew', 'soft',
    'filling', 'energizing', 'calming', 'health',
    'sanity', 'sadness', 'fear', 'sentience', 'radioactivity', 'voidLevel'
];

// Feedback category groupings for taste test
export const FEEDBACK_CATEGORIES = {
    "FLAVOR": ['savory', 'sweet', 'salty', 'sour', 'bitter', 'spicy'],
    "TEXTURE": ['temperature', 'moisture', 'grease', 'crunch', 'chew', 'soft'],
    "EFFECT": ['filling', 'energizing', 'caffeine', 'calming', 'health'],
    "COSMIC": ['sanity', 'sadness', 'fear', 'sentience', 'radioactivity', 'voidLevel'],
    "FLAGS": ['isBurnt', 'isRaw', 'isVegetarian', 'isVegan', 'containsGluten', 'containsBone'],
};

// Attribute descriptions for customer demand hints
export const ATTR_DESCRIPTIONS = {
    savory: "savory",
    sweet: "sweet",
    salty: "salty",
    sour: "sour",
    bitter: "bitter",
    spicy: "spicy",
    temperature: val => val <= 2 ? "FROZEN" : val <= 4 ? "cold" : val >= 12 ? "INFERNAL" : val >= 9 ? "hot" : val >= 7 ? "warm" : null,
    moisture: val => val >= 9 ? "liquid" : val <= 2 ? "dry" : null,
    grease: val => val >= 6 ? "greasy" : val === 0 ? "no grease" : null,
    crunch: val => val >= 6 ? "crunchy" : null,
    chew: val => val >= 7 ? "chewy" : null,
    soft: val => val >= 8 ? "soft" : null,
    filling: val => val >= 7 ? "filling" : val <= 3 ? "light" : null,
    energizing: val => val >= 6 ? "energizing" : null,
    caffeine: val => val >= 8 ? "HIGH CAFFEINE" : val >= 4 ? "caffeinated" : null,
    calming: val => val >= 5 ? "calming" : val < 0 ? "stressful" : null,
    health: val => val >= 7 ? "healthy" : val <= 0 ? "toxic" : null,
    sanity: val => val <= -5 ? "SANITY-DRAINING" : val >= 3 ? "sanity-restoring" : null,
    sadness: val => val >= 5 ? "depressing" : null,
    fear: val => val >= 5 ? "terrifying" : null,
    sentience: val => val >= 3 ? "SENTIENT" : null,
    radioactivity: val => val >= 5 ? "RADIOACTIVE" : null,
    voidLevel: val => val >= 5 ? "VOID-TOUCHED" : null,
    isVegetarian: val => val >= 1 ? "vegetarian" : null,
    isVegan: val => val >= 1 ? "vegan" : null,
    isRaw: val => val >= 1 ? "RAW" : null,
    isBurnt: val => val >= 1 ? "burnt" : null,
    containsGluten: val => val >= 1 ? "with gluten" : null,
};

// Gordon G boss configuration
export const GORDON_G_CONFIG = {
    name: "Gordon G. Scowling",
    coursesRequired: 3,
    avatar: `  [G]
 <|||>
  /|\\
  / \\`,
    orders: [
        {
            name: "Appetizer",
            hint: "A PROPER salad! Fresh, crunchy, with oil dressing. HEALTHY!",
            demand: { crunch: 6, sour: 4, grease: 4, health: 8, isVegan: 1 },
            idealItem: "Dressed Salad",
            maxDistance: 8,
        },
        {
            name: "Main Course",
            hint: "The ULTIMATE beef bowl! Savory, filling, with EGG! PERFECTION!",
            demand: { savory: 9, salty: 6, filling: 10, temperature: 8, calming: 4 },
            idealItem: "Deluxe Beef Bowl",
            maxDistance: 8,
        },
        {
            name: "Dessert",
            hint: "A chocolate shake! COLD. SWEET. CREAMY. ICE COLD!",
            demand: { sweet: 9, soft: 10, moisture: 8, temperature: 1, calming: 4 },
            idealItem: "Chocolate Shake",
            maxDistance: 8,
        }
    ]
};
