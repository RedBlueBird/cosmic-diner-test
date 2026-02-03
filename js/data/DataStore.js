// DataStore.js - Centralized data storage and getters for loaded game data

// Module-level storage for loaded data
let RECIPES = {};
let ADDITIONS = {};
let MUTATIONS = {};
let AMPLIFICATIONS = {};
let ATOMS = [];
let DEFAULT_ATTRIBUTES = {};
let FOOD_ATTRIBUTES = {};
let TASTE_FEEDBACK = {};
let CUSTOMER_TYPES = [];
let ARTIFACTS = [];
let CONSUMABLES = [];

// Setters for loaders
export function setFoodData(data) {
    ATOMS = data.atoms;
    DEFAULT_ATTRIBUTES = data.defaultAttributes;
}

export function setRecipes(data) {
    RECIPES = data.recipes;
    ADDITIONS = data.additions;
    MUTATIONS = data.mutations;
    AMPLIFICATIONS = data.amplifications;
}

export function setFoodAttributes(data) {
    FOOD_ATTRIBUTES = data;
}

export function setTasteFeedback(data) {
    TASTE_FEEDBACK = data;
}

export function setCustomerTypes(data) {
    CUSTOMER_TYPES = data;
}

export function setArtifacts(data) {
    ARTIFACTS = data;
}

export function setConsumables(data) {
    CONSUMABLES = data;
}

// Getters
export function getRecipes() {
    return RECIPES;
}

export function getAdditions() {
    return ADDITIONS;
}

export function getAtoms() {
    return ATOMS;
}

export function getDefaultAttributes() {
    return DEFAULT_ATTRIBUTES;
}

export function getFoodAttributesData() {
    return FOOD_ATTRIBUTES;
}

export function getTasteFeedbackData() {
    return TASTE_FEEDBACK;
}

export function getCustomerTypes() {
    return CUSTOMER_TYPES;
}

export function getArtifacts() {
    return ARTIFACTS;
}

export function getArtifactById(id) {
    return ARTIFACTS.find(artifact => artifact.id === id);
}

export function getConsumables() {
    return CONSUMABLES;
}

export function getConsumableById(id) {
    return CONSUMABLES.find(c => c.id === id);
}

// Recipe lookup helper - checks both ingredient orders
export function getRecipeResult(ingredient1, ingredient2) {
    const key1 = ingredient1 + "+" + ingredient2;
    const key2 = ingredient2 + "+" + ingredient1;
    return RECIPES[key1] || RECIPES[key2];
}

// Helper to create food attributes with defaults
export function createFoodAttr(overrides) {
    return { ...DEFAULT_ATTRIBUTES, ...overrides };
}
