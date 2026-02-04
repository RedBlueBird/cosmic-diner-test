// MerchantManager.js - Morning Merchant system

import { getConsumables, getConsumableById, getRecipes, getAtoms } from '../data/DataStore.js';
import * as UI from '../ui.js';

// Base prices for consumables by rarity
const CONSUMABLE_BASE_PRICES = {
    common: 5,
    uncommon: 10,
    rare: 15,
    legendary: 20
};

// Base price for foods
const FOOD_BASE_PRICE = 15;

export class MerchantManager {
    constructor(gameState, callbacks) {
        this.state = gameState;
        this.callbacks = callbacks;
        this.currentStock = null;
    }

    /**
     * Check if merchant is currently active
     */
    isMerchantActive() {
        return this.currentStock !== null;
    }

    /**
     * Calculate price with day multiplier
     * Day 2 = 1x, Day 3 = 1.5x, Day 4 = 2.25x, Day 5 = 3.375x
     */
    calculatePrice(basePrice) {
        const multiplier = Math.pow(1.5, this.state.day - 2);
        return Math.ceil(basePrice * multiplier);
    }

    /**
     * Calculate usage cost (fridge withdrawal cost) based on day
     * Day 2 = $2, Day 3 = $3, Day 4 = $4.5, Day 5 = $6.75
     * This cost is locked in at purchase time
     */
    calculateUsageCost() {
        const baseCost = 2;
        const multiplier = Math.pow(1.5, this.state.day - 2);
        return Math.ceil(baseCost * multiplier);
    }

    /**
     * Generate merchant stock: 3 random consumables + 3 random unlockable foods
     */
    generateMerchantStock() {
        const consumables = this.generateConsumableStock();
        const foods = this.generateFoodStock();

        this.currentStock = {
            consumables,
            foods
        };

        return this.currentStock;
    }

    /**
     * Get 3 random consumables (no duplicates)
     */
    generateConsumableStock() {
        const allConsumables = getConsumables();
        const shuffled = [...allConsumables].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 3);

        return selected.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            rarity: c.rarity,
            basePrice: CONSUMABLE_BASE_PRICES[c.rarity] || 10,
            price: this.calculatePrice(CONSUMABLE_BASE_PRICES[c.rarity] || 10)
        }));
    }

    /**
     * Get 3 random foods not already in availableIngredients
     */
    generateFoodStock() {
        const RECIPES = getRecipes();
        const atoms = getAtoms();
        const recipeResults = [...new Set(Object.values(RECIPES))];
        const allFoods = [...atoms, ...recipeResults];

        // Filter out already available ingredients
        const notUnlocked = allFoods.filter(
            food => !this.state.availableIngredients.includes(food)
        );

        // Shuffle and take up to 3
        const shuffled = [...notUnlocked].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 3);

        const usageCost = this.calculateUsageCost();

        return selected.map(name => ({
            name,
            basePrice: FOOD_BASE_PRICE,
            price: this.calculatePrice(FOOD_BASE_PRICE),
            usageCost: usageCost // Cost per use from fridge (locked in)
        }));
    }

    /**
     * Show the merchant in the right panel
     */
    showMerchant() {
        this.generateMerchantStock();
        this.callbacks.onLog("MORNING MERCHANT ARRIVES");
        this.callbacks.onLog("A traveling merchant offers wares before the day begins...");

        this.updateMerchantUI();
    }

    /**
     * Update the merchant UI in the right panel
     */
    updateMerchantUI() {
        UI.updateMerchantDisplay(
            this.currentStock,
            this.state.money,
            (id, price) => this.buyConsumable(id, price),
            (name, price, usageCost) => this.buyFood(name, price, usageCost)
        );
    }

    /**
     * Buy a consumable from the merchant
     */
    buyConsumable(consumableId, price) {
        if (this.state.money < price) {
            const messages = [
                "MERCHANT: \"You're too broke for this! Come back with more coin.\"",
                "MERCHANT: \"Sorry pal, your wallet's lighter than my pack mule.\"",
                "MERCHANT: \"Not enough cash, friend. This ain't a charity!\"",
                "MERCHANT: \"You can't afford that! Maybe try the dumpster out back?\"",
                "MERCHANT: \"Got any more gold hiding? No? Then keep walking.\""
            ];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            this.callbacks.onLog(randomMessage, "error");
            return;
        }

        const consumable = getConsumableById(consumableId);
        this.state.money -= price;
        this.callbacks.grantConsumable(consumableId, 1);
        this.callbacks.onLog(`Purchased ${consumable.name} for $${price}!`, "system");

        // Remove from stock
        this.currentStock.consumables = this.currentStock.consumables.filter(
            c => c.id !== consumableId
        );

        // Update the UI with new stock and money
        this.updateMerchantUI();
        this.callbacks.onRender();
    }

    /**
     * Buy a food (unlock ingredient) from the merchant
     */
    buyFood(foodName, price, usageCost) {
        if (this.state.money < price) {
            const messages = [
                "MERCHANT: \"You're too broke for this! Come back with more coin.\"",
                "MERCHANT: \"Sorry pal, your wallet's lighter than my pack mule.\"",
                "MERCHANT: \"Not enough cash, friend. This ain't a charity!\"",
                "MERCHANT: \"You can't afford that! Maybe try the dumpster out back?\"",
                "MERCHANT: \"Got any more gold hiding? No? Then keep walking.\""
            ];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            this.callbacks.onLog(randomMessage, "error");
            return;
        }

        this.state.money -= price;

        // Unlock the ingredient
        if (!this.state.availableIngredients.includes(foodName)) {
            this.state.availableIngredients.push(foodName);
            this.state.merchantUnlockPrices[foodName] = price; // Store unlock price
            this.state.ingredientCosts[foodName] = usageCost; // Store usage cost (locked in)
            this.callbacks.onLog(`Purchased ${foodName} for $${price}! Fridge cost: $${usageCost}/use`, "system");

            // Track in recipe book as merchant purchase
            this.callbacks.trackMerchantPurchase(foodName);
        }

        // Remove from stock
        this.currentStock.foods = this.currentStock.foods.filter(
            f => f.name !== foodName
        );

        // Update the UI with new stock and money
        this.updateMerchantUI();
        this.callbacks.onRender();
    }

    /**
     * Dismiss the merchant and continue the day
     */
    dismissMerchant() {
        UI.hideMerchantDisplay();
        this.callbacks.onLog("The Morning Merchant departs...");
        this.currentStock = null;

        // Merchant counts as 1 customer served
        this.state.customersServedCount++;
        this.callbacks.onRender();

        // Spawn next customer
        setTimeout(() => {
            this.callbacks.onNextCustomer();
        }, 500);
    }
}
