// Game configuration constants

// Starting values
export const STARTING_MONEY = 3000;
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
export const TERRIBLE_SERVICE_SANITY_PENALTY = 20;
export const POOR_SERVICE_SANITY_PENALTY = 10;
export const BOSS_FAILURE_SANITY_PENALTY = 60;

// Divine intervention (softlock prevention)
export const DIVINE_INTERVENTION_SANITY_RATE = 0.2;

// Merchant system
export const MERCHANT_CONSUMABLE_BASE_PRICES = { common: 5, uncommon: 8, rare: 12, legendary: 15 };
export const MERCHANT_FOOD_BASE_PRICE = 12;
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

// Default keybindings (action -> key)
export const DEFAULT_KEYBINDINGS = {
    fridge: 'Q', pan: 'W', board: 'E', amp: 'R', microwave: 'T', trash: 'Y',
    tasteTest: 'Z', serve: 'X', confirm: 'C',
    slot1: '1', slot2: '2', slot3: '3', slot4: '4', slot5: '5',
    slot6: '6', slot7: '7', slot8: '8', slot9: '9', deselectAll: '0',
    consumable1: 'A', consumable2: 'S', consumable3: 'D', consumable4: 'F', consumable5: 'G',
    settings: 'Escape',
};

// Human-readable labels for keybinding display
export const KEYBINDING_LABELS = {
    fridge: 'Fridge', pan: 'Pan', board: 'Board', amp: 'Amplifier',
    microwave: 'Microwave', trash: 'Trash', tasteTest: 'Taste Test', serve: 'Serve',
    confirm: 'Confirm (Collect / Leave Shop)',
    slot1: 'Select Slot 1', slot2: 'Select Slot 2', slot3: 'Select Slot 3',
    slot4: 'Select Slot 4', slot5: 'Select Slot 5', slot6: 'Select Slot 6',
    slot7: 'Select Slot 7', slot8: 'Select Slot 8', slot9: 'Select Slot 9',
    deselectAll: 'Deselect All',
    consumable1: 'Use Consumable 1', consumable2: 'Use Consumable 2',
    consumable3: 'Use Consumable 3', consumable4: 'Use Consumable 4',
    consumable5: 'Use Consumable 5',
    settings: 'Open Settings',
};

// Keys that cannot be used for rebinding
export const BLOCKED_REBIND_KEYS = ['Control', 'Alt', 'Shift', 'Meta', 'Tab'];

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
