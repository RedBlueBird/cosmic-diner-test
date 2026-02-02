// DataLoader.js - Async loaders for JSON data files

import {
    setFoodData,
    setTasteFeedback,
    setCustomerTypes,
    setArtifacts,
    setConsumables,
    createFoodAttr
} from './DataStore.js';

// Load food data from JSON file
export async function loadFoodData() {
    try {
        const response = await fetch('data/food-data.json');
        const data = await response.json();

        // Build FOOD_ATTRIBUTES by applying defaults to each food's overrides
        const processedFoodAttributes = {};
        for (const [foodName, overrides] of Object.entries(data.foodAttributes)) {
            processedFoodAttributes[foodName] = { ...data.defaultAttributes, ...overrides };
        }

        // Merge mutations and amplifications into recipes for backward compatibility
        const mergedRecipes = {
            ...data.recipes,
            ...data.mutations,
            ...data.amplifications
        };

        setFoodData({
            recipes: mergedRecipes,
            mutations: data.mutations,
            amplifications: data.amplifications,
            atoms: data.atoms,
            defaultAttributes: data.defaultAttributes,
            foodAttributes: processedFoodAttributes
        });

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
        const data = await response.json();
        setTasteFeedback(data);
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
        const data = await response.json();
        setCustomerTypes(data);
        console.log('Customer data loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load customer data:', error);
        return false;
    }
}

// Load artifacts from JSON
export async function loadArtifacts() {
    try {
        const response = await fetch('data/artifacts.json');
        const data = await response.json();
        setArtifacts(data);
        console.log('Artifact data loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load artifact data:', error);
        return false;
    }
}

// Load consumables from JSON
export async function loadConsumables() {
    try {
        const response = await fetch('data/consumables.json');
        const data = await response.json();
        setConsumables(data.consumables);
        console.log('Consumables loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load consumables:', error);
        return false;
    }
}
