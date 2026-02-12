// ConsumableManager.js - Consumables system management

import { MAX_CONSUMABLES } from '../config.js';
import { getConsumables, getConsumableById, getAllFoods } from '../data/DataStore.js';
import { createItemObject, getItemName, getItemModifiers, getFoodAttributes } from '../utils/ItemUtils.js';

export class ConsumableManager {
    constructor(gameState, callbacks) {
        this.state = gameState;
        this.callbacks = callbacks;
    }

    grantRandomConsumable() {
        const consumables = getConsumables();
        const random = consumables[Math.floor(Math.random() * consumables.length)];
        const success = this.grantConsumable(random.id, 1);
        if (success) {
            this.callbacks.onLog(`Starting bonus: Received ${random.name}!`, "consumable");
        } else {
            // Extremely unlikely, but handle gracefully
            this.callbacks.onLog(`Starting bonus: Could not grant consumable (inventory full)`, "error");
        }
    }

    getTotalConsumables() {
        return Object.keys(this.state.consumableInventory)
            .reduce((sum, id) => sum + (this.state.consumableInventory[id] || 0), 0);
    }

    grantConsumable(consumableId, quantity = 1) {
        // Calculate current total consumables (sum of all quantities)
        const currentTotal = this.getTotalConsumables();

        // Check if adding this quantity would exceed capacity
        if (currentTotal + quantity > MAX_CONSUMABLES) {
            const consumable = getConsumableById(consumableId);
            this.callbacks.onLog(`Cannot carry more than ${MAX_CONSUMABLES} consumables! Discard some first.`, "error");
            return false; // Indicate failure
        }

        // Grant the consumable
        if (!this.state.consumableInventory[consumableId]) {
            this.state.consumableInventory[consumableId] = 0;
        }
        this.state.consumableInventory[consumableId] += quantity;
        this.callbacks.onRender();
        return true; // Indicate success
    }

    selectConsumable(consumableId) {
        if (this.state.selectedConsumable === consumableId) {
            this.state.selectedConsumable = null;
            this.callbacks.onLog("Consumable deselected.", "consumable");
        } else {
            const consumable = getConsumableById(consumableId);
            this.state.selectedConsumable = consumableId;
            this.callbacks.onLog(`Selected: ${consumable.name}. ${consumable.description}`, "consumable");
        }
        this.callbacks.onRender();
    }

    useConsumable() {
        if (!this.state.selectedConsumable) {
            this.callbacks.onLog("No consumable selected!", "error");
            return;
        }

        const consumable = getConsumableById(this.state.selectedConsumable);
        const qty = this.state.consumableInventory[this.state.selectedConsumable] || 0;

        if (qty <= 0) {
            this.callbacks.onLog(`Out of ${consumable.name}!`, "error");
            return;
        }

        const effectType = consumable.effect.type;

        try {
            if (effectType === 'attribute_modifier') {
                this.applyAttributeModifier(consumable);
            } else if (effectType === 'sanity_restore') {
                this.applySanityRestore(consumable);
            } else if (effectType === 'payment_multiplier') {
                this.state.activeEffects.goldenCoins += consumable.effect.duration;
                this.callbacks.onLog(`${consumable.name}: Next customer pays ${consumable.effect.value}x!`, "consumable");
            } else if (effectType === 'serve_emergency_food') {
                this.serveEmergencyFood(consumable);
            } else if (effectType === 'duplicate_item') {
                this.duplicateSelectedItem();
            } else if (effectType === 'unlock_random_ingredient') {
                this.unlockRandomIngredient(consumable);
            } else if (effectType === 'force_rating') {
                this.state.activeEffects.goldenPlate = true;
                this.callbacks.onLog(`${consumable.name}: Next dish gets PERFECT rating!`, "consumable");
            } else if (effectType === 'cursed_boost') {
                this.applyCursedBoost(consumable);
            } else if (effectType === 'grant_artifact') {
                this.callbacks.onGrantArtifact();
            } else if (effectType === 'skip_customer') {
                this.skipCurrentCustomer();
            } else if (effectType === 'free_withdrawals') {
                this.state.activeEffects.freeWithdrawals += consumable.effect.count;
                this.callbacks.onLog(`${consumable.name}: Next ${consumable.effect.count} fridge uses are free!`, "consumable");
            }

            // Consume the item
            this.state.consumableInventory[this.state.selectedConsumable]--;
            this.state.selectedConsumable = null;
            this.callbacks.onClearSelection();
            this.callbacks.onRender();
        } catch (error) {
            this.callbacks.onRender();
        }
    }

    applyAttributeModifier(consumable) {
        if (this.state.selectedIndices.length !== 1) {
            const errorMsg = `${consumable.name.toUpperCase()} requires exactly 1 item selected.`;
            this.callbacks.onLog(errorMsg, "error");
            throw new Error("Need item selection");
        }

        const itemIndex = this.state.selectedIndices[0];
        const itemObj = this.state.countertop[itemIndex];
        const modifiers = consumable.effect.modifiers;

        for (const [attr, value] of Object.entries(modifiers)) {
            itemObj.modifiers[attr] = (itemObj.modifiers[attr] || 0) + value;
        }

        const modList = Object.entries(modifiers)
            .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
            .join(', ');
        this.callbacks.onLog(`Applied ${consumable.name} to ${itemObj.name}! (${modList})`, "consumable");
    }

    applySanityRestore(consumable) {
        const restoreAmount = consumable.effect.value;
        this.callbacks.onRestoreSanity(restoreAmount);
        this.callbacks.onLog(`${consumable.name}: Restored ${restoreAmount} sanity!`, "consumable");
    }

    serveEmergencyFood(consumable) {
        if (!this.state.customer) {
            this.callbacks.onLog("No customer to serve!", "error");
            throw new Error("No customer");
        }

        if (this.state.customer.isBoss) {
            this.callbacks.onLog("Cannot serve emergency rations to the boss!", "error");
            throw new Error("Cannot serve to boss");
        }

        const payment = consumable.effect.payment;
        this.state.money += payment;
        this.callbacks.onLog(`${consumable.name}: Customer accepts emergency rations and pays $${payment}!`, "consumable");

        this.callbacks.onAdvanceCustomer(500);
    }

    duplicateSelectedItem() {
        if (this.state.selectedIndices.length !== 1) {
            this.callbacks.onLog("MIRROR SHARD requires exactly 1 item selected.", "error");
            throw new Error("Need item selection");
        }

        const itemIndex = this.state.selectedIndices[0];
        const itemObj = this.state.countertop[itemIndex];
        const itemName = getItemName(itemObj);
        const modifiers = getItemModifiers(itemObj);

        const duplicate = createItemObject(itemName, modifiers);
        const success = this.callbacks.addToCountertop(duplicate, {}, true);
        if (!success) {
            throw new Error("Countertop full");
        }

        this.callbacks.onLog(`Mirror Shard: Duplicated ${itemName}${Object.keys(modifiers).length > 0 ? ' (with modifiers)' : ''}!`, "consumable");
    }

    unlockRandomIngredient(consumable) {
        const allFoods = getAllFoods();

        const notInFridge = allFoods.filter(food => !this.state.availableIngredients.includes(food));

        if (notInFridge.length === 0) {
            this.callbacks.onLog("All ingredients already unlocked!", "consumable");
            return;
        }

        const randomFood = notInFridge[Math.floor(Math.random() * notInFridge.length)];
        const cost = consumable.effect.cost;

        this.state.availableIngredients.push(randomFood);
        this.state.ingredientCosts[randomFood] = cost;

        this.callbacks.onLog(`${consumable.name}: Unlocked ${randomFood} ($${cost}) in your fridge!`, "consumable");
    }

    applyCursedBoost(consumable) {
        if (this.state.selectedIndices.length !== 1) {
            this.callbacks.onLog("CURSED CUTLERY requires exactly 1 item selected.", "error");
            throw new Error("Need item selection");
        }

        const itemIndex = this.state.selectedIndices[0];
        const itemObj = this.state.countertop[itemIndex];
        const boost = consumable.effect.all_attributes_boost;
        const voidBoost = consumable.effect.void_boost;

        const currentAttrs = getFoodAttributes(itemObj);

        for (const attr in currentAttrs) {
            if (currentAttrs[attr] !== 0) {
                itemObj.modifiers[attr] = (itemObj.modifiers[attr] || 0) + boost;
            }
        }

        itemObj.modifiers.void = (itemObj.modifiers.void || 0) + voidBoost;

        this.callbacks.onLog(`${consumable.name}: ${itemObj.name} is now EXTREMELY POWERFUL (+${boost} all, +${voidBoost} void)!`, "consumable");
    }

    skipCurrentCustomer() {
        if (this.state.customersServedCount >= this.state.customersPerDay) {
            this.callbacks.onLog("No more customers left today!", "error");
            throw new Error("No customers left today");
        }

        if (!this.state.customer) {
            this.callbacks.onLog("No customer to skip!", "error");
            throw new Error("No customer");
        }

        if (this.state.customer.isBoss) {
            this.callbacks.onLog("Cannot skip the boss!", "error");
            throw new Error("Cannot skip boss");
        }

        this.callbacks.onLog(`Wishing Well Penny: Skipped ${this.state.customer.name}!`, "consumable");

        this.callbacks.onAdvanceCustomer(500);
    }

    discardConsumable(consumableId) {
        const consumable = getConsumableById(consumableId);
        const qty = this.state.consumableInventory[consumableId] || 0;

        if (qty <= 0) {
            this.callbacks.onLog(`You don't have any ${consumable.name} to discard!`, "error");
            return;
        }

        // Remove one from inventory
        this.state.consumableInventory[consumableId]--;

        // Clear selection if this was the selected consumable
        if (this.state.selectedConsumable === consumableId) {
            this.state.selectedConsumable = null;
        }

        this.callbacks.onLog(`Discarded ${consumable.name}.`, "consumable");
        this.callbacks.onRender();
    }
}
