// RecipeService.js - Centralized recipe unlocking logic

import { getAdditions, getAtoms } from '../data/DataStore.js';
import { getItemModifiers } from '../utils/ItemUtils.js';

// Check if a dish is a simple dish (made from only 2 atoms)
export function isSimpleDish(itemName) {
    const additions = getAdditions();
    const ATOMS = getAtoms();

    // Check all possible 2-atom combinations in additions (pan recipes)
    for (const [combo, result] of Object.entries(additions)) {
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
// cost: base cost to store in ingredientCosts
// displayCost: optional cost to show in log messages for new recipe (includes artifact effects)
// oldDisplayCost: optional cost to show in log messages for old recipe (includes artifact effects)
export function tryUnlockRecipe(result, cost, availableIngredients, ingredientCosts, inputItems, log, displayCost = null, oldDisplayCost = null) {
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

    // Use displayCost for messages if provided, otherwise use stored cost
    const costToShow = displayCost !== null ? displayCost : cost;

    if (!availableIngredients.includes(result)) {
        availableIngredients.push(result);
        ingredientCosts[result] = cost;
        if (log) {
            log(`New recipe unlocked: ${result} ($${costToShow}) now available in Fridge!`, "system");
        }
        return true;
    } else if (cost < ingredientCosts[result]) {
        const oldCost = ingredientCosts[result];
        const oldCostMsg = oldDisplayCost !== null ? oldDisplayCost : oldCost;
        const newCostMsg = displayCost !== null ? displayCost : cost;
        ingredientCosts[result] = cost;
        if (log) {
            log(`Cheaper recipe for ${result} unlocked! $${oldCostMsg} -> $${newCostMsg}`, "system");
        }
        return true;
    }
    return false;
}
