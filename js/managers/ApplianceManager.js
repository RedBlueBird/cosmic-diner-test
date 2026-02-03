// ApplianceManager.js - Kitchen appliance operations

import { APPLIANCE_UNLOCK_DAYS } from '../config.js';
import { getRecipes, getRecipeResult, getArtifactById } from '../data/DataStore.js';
import { createItemObject, getItemName, getItemModifiers, mergeModifiers } from '../utils/ItemUtils.js';
import * as UI from '../ui.js';

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

        UI.showFridgeModal(
            this.state.availableIngredients,
            displayCosts,
            this.state.money,
            (item) => this.withdrawItem(item)
        );
    }

    closeFridge() {
        UI.hideFridgeModal();
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
        this.state.countertop.push(createItemObject(item));

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
        let cost1 = this.callbacks.getAtomCostWithArtifacts(item1, baseCost1);
        let cost2 = this.callbacks.getAtomCostWithArtifacts(item2, baseCost2);

        // Pan Perfectionist: Reduce ingredient costs
        if (this.callbacks.hasArtifact('pan_perfectionist')) {
            const artifact = getArtifactById('pan_perfectionist');
            const reduction = artifact.effect.value;
            cost1 = Math.max(1, Math.ceil(cost1 * reduction));
            cost2 = Math.max(1, Math.ceil(cost2 * reduction));
            const percent = Math.round((1 - reduction) * 100);
            this.callbacks.onLog(`PAN PERFECTIONIST: Ingredient costs reduced by ${percent}%!`, "system");
        }

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

        this.state.selectedIndices.sort((a, b) => b - a);
        this.state.countertop.splice(this.state.selectedIndices[0], 1);
        this.state.countertop.splice(this.state.selectedIndices[1], 1);
        this.state.countertop.push(createItemObject(result, mods));
        this.callbacks.onClearSelection();
        this.callbacks.onRender();
    }

    useBoard() {
        if (!this.state.isDayActive) return;
        if (this.state.selectedIndices.length !== 1) {
            this.callbacks.onLog("CHOPPING BOARD requires 1 item selected.", "error");
            return;
        }

        const RECIPES = getRecipes();
        const itemObj = this.state.countertop[this.state.selectedIndices[0]];
        const item = getItemName(itemObj);
        const mods = getItemModifiers(itemObj);

        // Calculate cost of source item with artifact modifiers (for display)
        const baseItemCost = this.state.ingredientCosts[item] || 1;
        const itemDisplayCost = this.callbacks.getAtomCostWithArtifacts(item, baseItemCost);

        let ingredients = null;
        for (let [key, val] of Object.entries(RECIPES)) {
            if (val === item && key.includes("+")) {
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

            this.state.countertop.splice(this.state.selectedIndices[0], 1);
            this.state.countertop.push(createItemObject(ingredients[0], mods));
            this.state.countertop.push(createItemObject(ingredients[1], mods));
            // Track Board usage for BOTH resulting ingredients
            this.callbacks.trackRecipe('Board', ingredients[0], [itemObj]);
            this.callbacks.trackRecipe('Board', ingredients[1], [itemObj]);
        } else {
            this.callbacks.onLog(`Cannot split ${item}. It is atomic or generic.`, "error");
        }
        this.callbacks.onClearSelection();
        this.callbacks.onRender();
    }

    useAmp() {
        if (!this.state.isDayActive) return;
        if (this.state.selectedIndices.length !== 1) {
            this.callbacks.onLog("AMPLIFIER requires 1 item.", "error");
            return;
        }

        const RECIPES = getRecipes();
        const itemObj = this.state.countertop[this.state.selectedIndices[0]];
        const item = getItemName(itemObj);
        const mods = getItemModifiers(itemObj);
        const baseItemCost = this.state.ingredientCosts[item] || 1;
        const itemDisplayCost = this.callbacks.getAtomCostWithArtifacts(item, baseItemCost);

        if (RECIPES[item] && !item.includes("+")) {
            const result = RECIPES[item];

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

        const RECIPES = getRecipes();
        const itemObj = this.state.countertop[this.state.selectedIndices[0]];
        const item = getItemName(itemObj);
        const mods = getItemModifiers(itemObj);
        const baseItemCost = this.state.ingredientCosts[item] || 1;
        const itemDisplayCost = this.callbacks.getAtomCostWithArtifacts(item, baseItemCost);
        const chance = Math.random();

        this.state.countertop.splice(this.state.selectedIndices[0], 1);

        let result;
        if (RECIPES[item] && (item === "Meat" || item === "Fish" || item === "Egg" || item === "Potato" || item === "Cheese")) {
            result = RECIPES[item];
            const resultFridgeCost = this.callbacks.getAtomCostWithArtifacts(result, baseItemCost);
            this.callbacks.onLog(`Microwave mutated ${item} ($${itemDisplayCost}) into ${result} ($${resultFridgeCost})!`);
            this.state.countertop.push(createItemObject(result, mods));
            this.callbacks.unlockIngredient(result, baseItemCost, [itemObj], resultFridgeCost);
            // Track Microwave recipe for recipe book
            this.callbacks.trackRecipe('Microwave', result, [itemObj]);
        } else if (chance > 0.7) {
            result = "Radioactive Slime";
            const resultFridgeCost = this.callbacks.getAtomCostWithArtifacts(result, baseItemCost);
            this.callbacks.onLog(`Microwave mutated ${item} ($${itemDisplayCost}) into: RADIOACTIVE SLIME ($${resultFridgeCost})`, "error");
            this.state.countertop.push(createItemObject(result, mods));
            this.callbacks.unlockIngredient(result, baseItemCost, [itemObj], resultFridgeCost);
            // Track Microwave recipe for recipe book
            this.callbacks.trackRecipe('Microwave', result, [itemObj]);
        } else {
            result = "Hot " + item;
            const resultFridgeCost = this.callbacks.getAtomCostWithArtifacts(result, baseItemCost);
            this.callbacks.onLog(`Microwave made ${item} ($${itemDisplayCost}) really hot -> ${result} ($${resultFridgeCost})`);
            this.state.countertop.push(createItemObject(result, mods));
            this.callbacks.unlockIngredient(result, baseItemCost, [itemObj], resultFridgeCost);
            // Track Microwave recipe for recipe book
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

            if (this.callbacks.hasArtifact('the_recycler')) {
                const artifact = getArtifactById('the_recycler');
                const refundRate = artifact.effect.value;
                const itemCost = this.state.ingredientCosts[getItemName(item)] || 1;
                const refund = Math.ceil(itemCost * refundRate);
                totalRefund += refund;
            }

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
