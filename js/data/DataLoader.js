// DataLoader.js - Async loaders for JSON data files

import {
    setFoodData,
    setRecipes,
    setFoodAttributes,
    setTasteFeedback,
    setCustomerTypes,
    setArtifacts,
    setConsumables,
    createFoodAttr
} from './DataStore.js';

// Load food data (atoms and defaultAttributes) from JSON file
export async function loadFoodData() {
    try {
        const response = await fetch('data/food-data.json');
        const data = await response.json();

        setFoodData({
            atoms: data.atoms,
            defaultAttributes: data.defaultAttributes
        });

        console.log('Food data loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load food data:', error);
        return false;
    }
}

// Load recipes (additions, mutations, amplifications) from JSON file
export async function loadRecipes() {
    try {
        const response = await fetch('data/recipes.json');
        const data = await response.json();

        // Merge mutations and amplifications into additions for backward compatibility
        const mergedRecipes = {
            ...data.additions,
            ...data.mutations,
            ...data.amplifications
        };

        setRecipes({
            recipes: mergedRecipes,
            additions: data.additions,
            mutations: data.mutations,
            amplifications: data.amplifications
        });

        console.log('Recipes loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load recipes:', error);
        return false;
    }
}

// Load food attributes from JSON file
export async function loadFoodAttributes() {
    try {
        const [foodAttrResponse, foodDataResponse] = await Promise.all([
            fetch('data/food-attributes.json'),
            fetch('data/food-data.json')
        ]);

        const foodAttrData = await foodAttrResponse.json();
        const foodData = await foodDataResponse.json();

        // Build FOOD_ATTRIBUTES by applying defaults to each food's overrides
        const processedFoodAttributes = {};
        for (const [foodName, overrides] of Object.entries(foodAttrData.foodAttributes)) {
            processedFoodAttributes[foodName] = { ...foodData.defaultAttributes, ...overrides };
        }

        setFoodAttributes(processedFoodAttributes);

        console.log('Food attributes loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load food attributes:', error);
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
