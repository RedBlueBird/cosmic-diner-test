// RecipeService.js - Centralized recipe unlocking logic

import { getRecipes, getAtoms } from '../data/DataStore.js';
import { getItemModifiers } from '../utils/ItemUtils.js';

// Check if a dish is a simple dish (made from only 2 atoms)
export function isSimpleDish(itemName) {
    const recipes = getRecipes();
    const ATOMS = getAtoms();

    // Check all possible 2-atom combinations
    for (const [combo, result] of Object.entries(recipes)) {
        if (result === itemName) {
            const parts = combo.split('+');
            // A simple dish is made from exactly 2 atoms (base ingredients)
            if (parts.length === 2 && ATOMS.includes(parts[0]) && ATOMS.includes(parts[1])) {
                return true;
            }
        }
    }

    return false;
}

// Try to unlock a recipe if conditions are met
// Returns true if unlocked or updated, false if no change
export function tryUnlockRecipe(result, cost, availableIngredients, ingredientCosts, inputItems, log) {
    // Check if any input item has the temporary modifier
    const hasTemporaryIngredient = inputItems.some(item => {
        const itemObj = typeof item === 'string' ? { name: item, modifiers: {} } : item;
        return itemObj.modifiers?.temporary > 0;
    });

    if (hasTemporaryIngredient) {
        if (log) {
            log("(Cannot unlock recipe - uses temporary ingredient)", "system");
        }
        return false;
    }

    if (!availableIngredients.includes(result)) {
        availableIngredients.push(result);
        ingredientCosts[result] = cost;
        if (log) {
            log(`NEW RECIPE UNLOCKED: ${result} ($${cost}) now available in Fridge!`, "system");
        }
        return true;
    } else if (cost < ingredientCosts[result]) {
        const oldCost = ingredientCosts[result];
        ingredientCosts[result] = cost;
        if (log) {
            log(`CHEAPER RECIPE FOR ${result.toUpperCase()} UNLOCKED! $${oldCost} -> $${cost}`, "system");
        }
        return true;
    }
    return false;
}
