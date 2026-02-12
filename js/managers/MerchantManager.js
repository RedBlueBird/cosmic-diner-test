// MerchantManager.js - Morning Merchant system

import { MERCHANT_CONSUMABLE_BASE_PRICES, MERCHANT_FOOD_BASE_PRICE, MERCHANT_BASE_USAGE_COST, MERCHANT_CONSUMABLE_PRICE_MULTIPLIER, MERCHANT_FOOD_PRICE_MULTIPLIER, MERCHANT_START_DAY, MERCHANT_STOCK_COUNT } from '../config.js';
import { getConsumables, getConsumableById, getAllFoods } from '../data/DataStore.js';

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
     * Day 2 = 1x, Day 3 = 1.2x, Day 4 = 1.44x
     */
    calculatePrice(basePrice, priceMultiplier) {
        const multiplier = Math.pow(priceMultiplier, this.state.day - MERCHANT_START_DAY);
        return Math.ceil(basePrice * multiplier);
    }

    /**
     * Calculate usage cost (fridge withdrawal cost) based on day
     * Day 2 = $2, Day 3 = $3, Day 4 = $3, Day 5 = $4, etc.
     * This cost is locked in at purchase time
     */
    calculateUsageCost() {
        const multiplier = Math.pow(MERCHANT_FOOD_PRICE_MULTIPLIER, this.state.day - MERCHANT_START_DAY);
        return Math.ceil(MERCHANT_BASE_USAGE_COST * multiplier);
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
     * Get random consumables (no duplicates)
     */
    generateConsumableStock() {
        const allConsumables = getConsumables();
        const shuffled = [...allConsumables].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, MERCHANT_STOCK_COUNT);

        return selected.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            rarity: c.rarity,
            basePrice: MERCHANT_CONSUMABLE_BASE_PRICES[c.rarity] || 10,
            price: this.calculatePrice(MERCHANT_CONSUMABLE_BASE_PRICES[c.rarity] || 10, MERCHANT_CONSUMABLE_PRICE_MULTIPLIER)
        }));
    }

    /**
     * Get random foods not already in availableIngredients
     */
    generateFoodStock() {
        const allFoods = getAllFoods();

        // Filter out already available ingredients
        const notUnlocked = allFoods.filter(
            food => !this.state.availableIngredients.includes(food)
        );

        // Shuffle and take up to stock count
        const shuffled = [...notUnlocked].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, MERCHANT_STOCK_COUNT);

        const usageCost = this.calculateUsageCost();

        return selected.map(name => ({
            name,
            basePrice: MERCHANT_FOOD_BASE_PRICE,
            price: this.calculatePrice(MERCHANT_FOOD_BASE_PRICE, MERCHANT_FOOD_PRICE_MULTIPLIER),
            usageCost: usageCost // Cost per use from fridge (locked in)
        }));
    }

    /**
     * Show the merchant in the right panel
     */
    showMerchant() {
        this.generateMerchantStock();
        this.callbacks.onLog("Morning Merchant arrives.", "merchant");
        this.callbacks.onLog("A traveling merchant offers wares before the day begins...", "merchant");

        this.updateMerchantUI();
    }

    /**
     * Update the merchant UI in the right panel
     */
    updateMerchantUI() {
        this.callbacks.updateMerchantDisplay(
            this.currentStock,
            this.state.money,
            (id, price) => this.buyConsumable(id, price),
            (name, price, usageCost) => this.buyFood(name, price, usageCost)
        );
    }

    showBrokeMessage() {
        const messages = [
            "MERCHANT: \"You're too broke for this! Come back with more coin.\"",
            "MERCHANT: \"Sorry pal, your wallet's lighter than my pack mule.\"",
            "MERCHANT: \"Not enough cash, friend. This ain't a charity!\"",
            "MERCHANT: \"You can't afford that! Maybe try the dumpster out back?\"",
            "MERCHANT: \"Got any more gold hiding? No? Then keep walking.\""
        ];
        this.callbacks.onLog(messages[Math.floor(Math.random() * messages.length)], "merchant");
    }

    /**
     * Buy a consumable from the merchant
     */
    buyConsumable(consumableId, price) {
        if (this.state.money < price) {
            this.showBrokeMessage();
            return;
        }

        const consumable = getConsumableById(consumableId);
        this.state.money -= price;

        const success = this.callbacks.grantConsumable(consumableId, 1);
        if (success) {
            this.callbacks.onLog(`Purchased ${consumable.name} for $${price}!`, "merchant");

            // Remove from stock
            this.currentStock.consumables = this.currentStock.consumables.filter(
                c => c.id !== consumableId
            );
        } else {
            // Refund the money since purchase failed
            this.state.money += price;
        }

        // Update the UI with new stock and money
        this.updateMerchantUI();
        this.callbacks.onRender();
    }

    /**
     * Buy a food (unlock ingredient) from the merchant
     */
    buyFood(foodName, price, usageCost) {
        if (this.state.money < price) {
            this.showBrokeMessage();
            return;
        }

        this.state.money -= price;

        // Unlock the ingredient
        if (!this.state.availableIngredients.includes(foodName)) {
            this.state.availableIngredients.push(foodName);
            this.state.merchantUnlockPrices[foodName] = price; // Store unlock price
            this.state.ingredientCosts[foodName] = usageCost; // Store usage cost (locked in)
            this.callbacks.onLog(`Purchased ${foodName} for $${price}! Fridge cost: $${usageCost}/use`, "merchant");

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
     * Buy an item by combined index (0-2 = consumables, 3-5 = foods)
     */
    buyItemByIndex(index) {
        if (!this.currentStock) return;

        const consumableCount = this.currentStock.consumables.length;
        if (index < consumableCount) {
            const item = this.currentStock.consumables[index];
            this.buyConsumable(item.id, item.price);
        } else {
            const foodIndex = index - consumableCount;
            if (foodIndex < this.currentStock.foods.length) {
                const item = this.currentStock.foods[foodIndex];
                this.buyFood(item.name, item.price, item.usageCost);
            }
        }
    }

    /**
     * Dismiss the merchant and continue the day
     */
    dismissMerchant() {
        if (!this.currentStock) return; // Already dismissed

        // Keep merchant view visible with disabled button until nextCustomer() transitions
        this.callbacks.disableLeaveButton("DEPARTING...");
        this.callbacks.onLog("The Morning Merchant departs...", "merchant");
        this.currentStock = null;

        // Merchant counts as 1 customer served
        this.state.customersServedCount++;
        this.callbacks.onRender();

        // Spawn next customer (showCustomerView in nextCustomer handles the view transition)
        setTimeout(() => {
            this.callbacks.onNextCustomer();
        }, 500);
    }
}
