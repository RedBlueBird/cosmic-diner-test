/**
 * RecipeBookManager - Tracks recipe discoveries and provides formatted output
 */

import PersistenceService from '../services/PersistenceService.js';
import { getItemName, hasTemporaryModifier } from '../utils/ItemUtils.js';

export default class RecipeBookManager {
    constructor() {
        this.persistence = PersistenceService;
    }

    /**
     * Load recipe book from persistence
     */
    loadFromPersistence() {
        this.persistence.loadRecipeBook();
    }

    /**
     * Track a recipe creation based on method
     * @param {string} method - 'Pan', 'Amplify', 'Microwave', 'Board'
     * @param {string|Object} result - Result item
     * @param {Array} inputItems - Array of input items
     */
    trackRecipe(method, result, inputItems) {
        // Filter out temporary items (Morning Prep artifact)
        const hasTemporary = inputItems.some(item => hasTemporaryModifier(item));
        if (hasTemporary) {
            return; // Don't track recipes using temporary items
        }

        const resultName = getItemName(result);

        if (method === 'Pan') {
            this.trackPanRecipe(resultName, inputItems[0], inputItems[1]);
        } else if (method === 'Amplify') {
            this.trackAmplifyRecipe(resultName, inputItems[0]);
        } else if (method === 'Microwave') {
            this.trackMicrowaveRecipe(resultName, inputItems[0]);
        } else if (method === 'Board') {
            this.trackBoardUsage(resultName, inputItems[0]);
        }
    }

    /**
     * Track Pan recipe (2 ingredients combined)
     */
    trackPanRecipe(resultName, item1Obj, item2Obj) {
        const ingredient1 = getItemName(item1Obj);
        const ingredient2 = getItemName(item2Obj);

        const discovery = {
            method: 'Pan',
            ingredients: [ingredient1, ingredient2]
        };

        this.persistence.addDiscovery(resultName, discovery);
    }

    /**
     * Track Amplifier transformation
     */
    trackAmplifyRecipe(resultName, sourceObj) {
        const sourceName = getItemName(sourceObj);

        const discovery = {
            method: 'Amplify',
            source: sourceName
        };

        this.persistence.addDiscovery(resultName, discovery);
    }

    /**
     * Track Microwave mutation
     */
    trackMicrowaveRecipe(resultName, sourceObj) {
        const sourceName = getItemName(sourceObj);

        const discovery = {
            method: 'Microwave',
            source: sourceName
        };

        this.persistence.addDiscovery(resultName, discovery);
    }

    /**
     * Track Board split - saves for the resulting ingredient
     */
    trackBoardUsage(resultName, sourceObj) {
        const sourceName = getItemName(sourceObj);

        const discovery = {
            method: 'Board',
            source: sourceName
        };

        this.persistence.addDiscovery(resultName, discovery);
    }

    /**
     * Track atom withdrawal from fridge (starting ingredient)
     */
    trackAtom(atomName) {
        const discovery = {
            method: 'Atom',
            isStarting: true
        };

        this.persistence.addDiscovery(atomName, discovery);
    }

    /**
     * Get formatted discovery methods for a food (for tooltip)
     * @param {string} foodName - Name of the food
     * @returns {string} Formatted methods string
     */
    getDiscoveryMethods(foodName) {
        const discoveries = this.persistence.getAllDiscoveries()[foodName];

        if (!discoveries || discoveries.length === 0) {
            return 'Unknown';
        }

        const methods = [];

        discoveries.forEach(discovery => {
            if (discovery.method === 'Pan' && discovery.ingredients) {
                methods.push(`Pan(${discovery.ingredients.join(' + ')})`);
            } else if (discovery.method === 'Atom') {
                methods.push('Starting Ingredient');
            } else if (discovery.method === 'Amplify') {
                methods.push(`Amplify(${discovery.source})`);
            } else if (discovery.method === 'Microwave') {
                methods.push(`Microwave(${discovery.source})`);
            } else if (discovery.method === 'Board') {
                methods.push(`Board(${discovery.source})`);
            }
        });

        // Remove duplicates and sort
        const uniqueMethods = [...new Set(methods)];
        uniqueMethods.sort();

        return uniqueMethods.join('\n');
    }

    /**
     * Get all discovered foods sorted alphabetically
     * @returns {Array<string>} Array of food names
     */
    getAllFoods() {
        const discoveries = this.persistence.getAllDiscoveries();
        return Object.keys(discoveries).sort();
    }

    /**
     * Get total count of discovered foods
     * @returns {number} Count of foods
     */
    getDiscoveryCount() {
        return this.getAllFoods().length;
    }
}
