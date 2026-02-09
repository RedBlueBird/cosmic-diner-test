// ApplianceManager.js - Kitchen appliance operations

import { APPLIANCE_UNLOCK_DAYS, DIVINE_INTERVENTION_SANITY_RATE } from '../config.js';
import { getRecipeResult, getAdditions, getMutations, getAmplifications } from '../data/DataStore.js';
import { createItemObject, getItemName, getItemModifiers, mergeModifiers } from '../utils/ItemUtils.js';
import { runHook } from '../effects/EffectHandlerRegistry.js';

export class ApplianceManager {
    constructor(gameState, callbacks) {
        this.state = gameState;
        this.callbacks = callbacks;
    }

    isApplianceUnlocked(appliance) {
        return this.state.day >= APPLIANCE_UNLOCK_DAYS[appliance];
    }

    useFridge() {
        if (!this.state.isDayActive) return;

        const displayCosts = {};
        this.state.availableIngredients.forEach(item => {
            const baseCost = this.state.ingredientCosts[item] || 1;
            displayCosts[item] = this.callbacks.getAtomCostWithArtifacts(item, baseCost);
        });

        // Softlock check: if broke with no items, trigger divine intervention
        const cheapestCost = Math.min(...Object.values(displayCosts));

        if (this.state.money < cheapestCost && this.state.countertop.length === 0) {
            // Calculate sanity loss (20% rounded, minimum keeps sanity at 1)
            const sanityLoss = Math.round(this.state.sanity * DIVINE_INTERVENTION_SANITY_RATE);
            const actualSanityLoss = Math.min(sanityLoss, this.state.sanity - 1);

            this.state.money += cheapestCost;
            this.state.sanity -= actualSanityLoss;

            this.callbacks.onLog(">> ELDRITCH INTERVENTION <<", "system");
            this.callbacks.onLog(`Reality warps. Something vast and incomprehensible stirs in the void.`, "system");
            this.callbacks.onLog(`It finds your poverty... amusing. Emergency funds materialize: +$${cheapestCost}`, "system");
            this.callbacks.onLog(`The encounter fractures your psyche: -${actualSanityLoss} sanity`, "error");
            this.callbacks.onRender();
        }

        this.callbacks.showFridgeModal(
            this.state.availableIngredients,
            displayCosts,
            this.state.money,
            (item) => this.withdrawItem(item)
        );
    }

    closeFridge() {
        this.callbacks.hideFridgeModal();
    }

    /**
     * Add item(s) to countertop with capacity checking
     * @param {string|Object|Array} items - Item name, item object, or array of item objects
     * @param {Object} modifiers - Optional modifiers if items is a string
     * @param {boolean} silent - If true, suppress "added" log message (default: false)
     * @returns {boolean} - True if all items added, false if capacity exceeded
     */
    addToCountertop(items, modifiers = {}, silent = false) {
        // Normalize input to array of item objects
        let itemsToAdd = [];
        if (Array.isArray(items)) {
            itemsToAdd = items;
        } else if (typeof items === 'string') {
            itemsToAdd = [createItemObject(items, modifiers)];
        } else {
            itemsToAdd = [items]; // Already an item object
        }

        // Check capacity (all-or-nothing approach)
        const capacity = this.callbacks.getCountertopCapacity();
        const spaceNeeded = this.state.countertop.length + itemsToAdd.length;

        if (spaceNeeded > capacity) {
            const itemNames = itemsToAdd.map(i => getItemName(i)).join(', ');
            this.callbacks.onLog(
                `Countertop full! Cannot add ${itemNames}. (${this.state.countertop.length}/${capacity})`,
                "error"
            );
            return false;
        }

        // Add all items
        itemsToAdd.forEach(item => {
            this.state.countertop.push(item);
        });

        // Optional success message
        if (!silent && itemsToAdd.length > 0) {
            const itemNames = itemsToAdd.map(i => getItemName(i)).join(', ');
            this.callbacks.onLog(`Added to countertop: ${itemNames}`);
        }

        this.callbacks.onRender();
        return true;
    }

    withdrawItem(item) {
        const capacity = this.callbacks.getCountertopCapacity();
        if (this.state.countertop.length >= capacity) {
            this.callbacks.onLog("Countertop is full!", "error");
            this.closeFridge();
            return;
        }

        const baseCost = this.state.ingredientCosts[item] || 1;
        let cost = this.callbacks.getAtomCostWithArtifacts(item, baseCost);
        cost = this.callbacks.applyBulkDiscount(item, cost);

        // Apply free withdrawal effect
        if (this.state.activeEffects.freeWithdrawals > 0) {
            this.state.activeEffects.freeWithdrawals--;
            this.callbacks.onLog(`QUANTUM FRIDGE: ${item} is FREE! (${this.state.activeEffects.freeWithdrawals} left)`, "system");
            cost = 0;
        }

        if (this.state.money < cost) {
            this.callbacks.onLog(`Cannot afford ${item} ($${cost})! You have $${this.state.money}.`, "error");
            this.closeFridge();
            return;
        }

        this.state.money -= cost;

        if (!this.addToCountertop(item)) {
            this.closeFridge();
            return;
        }

        // Track atom withdrawal for recipe book
        this.callbacks.trackAtom(item);

        if (cost > 0) {
            this.callbacks.onLog(`Withdrew ${item} from Fridge. -$${cost}`);
        } else {
            this.callbacks.onLog(`Withdrew ${item} from Fridge.`);
        }
        this.callbacks.onRender();
        this.closeFridge();
    }

    usePan() {
        if (!this.state.isDayActive) return;
        if (this.state.selectedIndices.length !== 2) {
            this.callbacks.onLog("PAN requires exactly 2 items selected.", "error");
            return;
        }

        const item1Obj = this.state.countertop[this.state.selectedIndices[0]];
        const item2Obj = this.state.countertop[this.state.selectedIndices[1]];
        const item1 = getItemName(item1Obj);
        const item2 = getItemName(item2Obj);

        const mods = mergeModifiers(getItemModifiers(item1Obj), getItemModifiers(item2Obj));

        const baseCost1 = this.state.ingredientCosts[item1] || 1;
        const baseCost2 = this.state.ingredientCosts[item2] || 1;
        const baseCostResult = runHook('modifyPanIngredientCost', this.state.activeArtifacts, {
            defaultValue: {
                cost1: this.callbacks.getAtomCostWithArtifacts(item1, baseCost1),
                cost2: this.callbacks.getAtomCostWithArtifacts(item2, baseCost2)
            },
            log: (msg, type) => this.callbacks.onLog(msg, type)
        });
        let cost1 = baseCostResult.cost1;
        let cost2 = baseCostResult.cost2;

        // Get the recipe result first
        let result = getRecipeResult(item1, item2);

        // Base cost for storage (sum of base costs)
        const baseCostForStorage = baseCost1 + baseCost2;

        // Display cost is what it will cost in the fridge (with Price Gouger applied to result)
        const resultFridgeCost = this.callbacks.getAtomCostWithArtifacts(result || "Unknown", baseCostForStorage);

        if (!result) {
            result = "Burnt Slop";
            this.callbacks.onLog(`Failed Combo: ${item1} + ${item2} = ${result}`, "error");
        } else {
            this.callbacks.onLog(`Cooking: ${item1} ($${cost1}) + ${item2} ($${cost2}) -> ${result} ($${resultFridgeCost})`);
            this.callbacks.unlockIngredient(result, baseCostForStorage, [item1Obj, item2Obj], resultFridgeCost);
            // Track Pan recipe for recipe book
            this.callbacks.trackRecipe('Pan', result, [item1Obj, item2Obj]);
        }

        const resultItem = createItemObject(result, mods);

        // Remove ingredients FIRST
        this.state.selectedIndices.sort((a, b) => b - a);
        this.state.countertop.splice(this.state.selectedIndices[0], 1);
        this.state.countertop.splice(this.state.selectedIndices[1], 1);

        // Add result (should never fail since we removed 2, added 1)
        this.addToCountertop(resultItem, {}, true); // silent=true, already logged
        this.callbacks.onClearSelection();
    }

    useBoard() {
        if (!this.state.isDayActive) return;
        if (this.state.selectedIndices.length !== 1) {
            this.callbacks.onLog("CHOPPING BOARD requires 1 item selected.", "error");
            return;
        }

        const ADDITIONS = getAdditions();
        const itemObj = this.state.countertop[this.state.selectedIndices[0]];
        const item = getItemName(itemObj);
        const mods = getItemModifiers(itemObj);

        // Calculate cost of source item with artifact modifiers (for display)
        const baseItemCost = this.state.ingredientCosts[item] || 1;
        const itemDisplayCost = this.callbacks.getAtomCostWithArtifacts(item, baseItemCost);

        let ingredients = null;
        for (let [key, val] of Object.entries(ADDITIONS)) {
            if (val === item) {
                ingredients = key.split("+");
                break;
            }
        }

        if (ingredients) {
            // Split results inherit the base cost of the source item (will be stored as base)
            // But display cost shows what they'll cost in fridge (with Price Gouger applied)
            const splitBaseCost = baseItemCost;
            const splitFridgeCost = this.callbacks.getAtomCostWithArtifacts(ingredients[0], splitBaseCost);

            this.callbacks.onLog(`Chopping: ${item} ($${itemDisplayCost}) -> ${ingredients[0]} ($${splitFridgeCost}) + ${ingredients[1]} ($${splitFridgeCost})`);

            // Unlock both split results at base cost (Price Gouger will be applied when withdrawing)
            this.callbacks.unlockIngredient(ingredients[0], splitBaseCost, [itemObj], splitFridgeCost);
            this.callbacks.unlockIngredient(ingredients[1], splitBaseCost, [itemObj], splitFridgeCost);

            // Create split items
            const splitItems = [
                createItemObject(ingredients[0], mods),
                createItemObject(ingredients[1], mods)
            ];

            // Check capacity BEFORE removing (since we remove 1, add 2 = net +1)
            const capacity = this.callbacks.getCountertopCapacity();
            if (this.state.countertop.length >= capacity) {
                this.callbacks.onLog("Countertop full! Need 1 free space to split item.", "error");
                this.callbacks.onClearSelection();
                this.callbacks.onRender();
                return;
            }

            // Remove original item
            this.state.countertop.splice(this.state.selectedIndices[0], 1);

            // Add split results (should never fail since we just freed 1 space)
            this.addToCountertop(splitItems, {}, true); // silent=true, already logged

            // Track Board usage for BOTH resulting ingredients
            this.callbacks.trackRecipe('Board', ingredients[0], [itemObj]);
            this.callbacks.trackRecipe('Board', ingredients[1], [itemObj]);
        } else {
            this.callbacks.onLog(`Cannot split ${item}. It is atomic or generic.`, "error");
        }
        this.callbacks.onClearSelection();
    }

    useAmp() {
        if (!this.state.isDayActive) return;
        if (this.state.selectedIndices.length !== 1) {
            this.callbacks.onLog("AMPLIFIER requires 1 item.", "error");
            return;
        }

        const AMPLIFICATIONS = getAmplifications();
        const itemObj = this.state.countertop[this.state.selectedIndices[0]];
        const item = getItemName(itemObj);
        const mods = getItemModifiers(itemObj);
        const baseItemCost = this.state.ingredientCosts[item] || 1;
        const itemDisplayCost = this.callbacks.getAtomCostWithArtifacts(item, baseItemCost);

        if (AMPLIFICATIONS[item]) {
            const result = AMPLIFICATIONS[item];

            // Result inherits base cost from source
            const resultFridgeCost = this.callbacks.getAtomCostWithArtifacts(result, baseItemCost);

            this.state.countertop[this.state.selectedIndices[0]] = createItemObject(result, mods);
            this.callbacks.onLog(`Amplified ${item} ($${itemDisplayCost}) into ${result} ($${resultFridgeCost})!`);
            this.callbacks.unlockIngredient(result, baseItemCost, [itemObj], resultFridgeCost);
            // Track Amplify recipe for recipe book
            this.callbacks.trackRecipe('Amplify', result, [itemObj]);
        } else {
            this.callbacks.onLog("Nothing happened. Item cannot be amplified.", "error");
        }

        this.callbacks.onClearSelection();
        this.callbacks.onRender();
    }

    useMicrowave() {
        if (!this.state.isDayActive) return;
        if (this.state.selectedIndices.length !== 1) {
            this.callbacks.onLog("MICROWAVE requires 1 item.", "error");
            return;
        }

        const MUTATIONS = getMutations();
        const itemObj = this.state.countertop[this.state.selectedIndices[0]];
        const item = getItemName(itemObj);
        const mods = getItemModifiers(itemObj);
        const baseItemCost = this.state.ingredientCosts[item] || 1;
        const itemDisplayCost = this.callbacks.getAtomCostWithArtifacts(item, baseItemCost);

        this.state.countertop.splice(this.state.selectedIndices[0], 1);

        let result;

        // Check if a mutation recipe exists for this item
        if (MUTATIONS[item]) {
            result = MUTATIONS[item];
            const resultFridgeCost = this.callbacks.getAtomCostWithArtifacts(result, baseItemCost);
            this.callbacks.onLog(`Microwave mutated ${item} ($${itemDisplayCost}) into ${result} ($${resultFridgeCost})!`);
            this.addToCountertop(createItemObject(result, mods), {}, true); // silent=true
            this.callbacks.unlockIngredient(result, baseItemCost, [itemObj], resultFridgeCost);
            this.callbacks.trackRecipe('Microwave', result, [itemObj]);
        } else {
            // 70% chance: Radioactive Slime
            result = "Radioactive Slime";
            const resultFridgeCost = this.callbacks.getAtomCostWithArtifacts(result, baseItemCost);
            this.callbacks.onLog(`Microwave mutated ${item} ($${itemDisplayCost}) into: RADIOACTIVE SLIME ($${resultFridgeCost})`, "error");
            this.addToCountertop(createItemObject(result, mods), {}, true); // silent=true
            this.callbacks.unlockIngredient(result, baseItemCost, [itemObj], resultFridgeCost);
            this.callbacks.trackRecipe('Microwave', result, [itemObj]);
        }

        this.callbacks.onClearSelection();
        this.callbacks.onRender();
    }

    useTrash() {
        if (!this.state.isDayActive) return;
        if (this.state.selectedIndices.length === 0) return;

        let totalRefund = 0;

        this.state.selectedIndices.sort((a, b) => b - a);
        this.state.selectedIndices.forEach(idx => {
            const item = this.state.countertop[idx];
            this.callbacks.onLog(`Trashed ${getItemName(item)}`);

            totalRefund = runHook('trashRefund', this.state.activeArtifacts, {
                defaultValue: totalRefund,
                itemCost: this.state.ingredientCosts[getItemName(item)] || 1
            });

            this.state.countertop.splice(idx, 1);
        });

        if (totalRefund > 0) {
            this.state.money += totalRefund;
            this.callbacks.onLog(`THE RECYCLER: Refunded $${totalRefund}!`, "system");
        }

        this.callbacks.onClearSelection();
        this.callbacks.onRender();
    }
}
