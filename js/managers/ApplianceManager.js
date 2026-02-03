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

        const totalCost = cost1 + cost2;

        let result = getRecipeResult(item1, item2);

        if (!result) {
            result = "Burnt Slop";
            this.callbacks.onLog(`Failed Combo: ${item1} + ${item2} = ${result}`, "error");
        } else {
            this.callbacks.onLog(`Cooking: ${item1} ($${cost1}) + ${item2} ($${cost2}) -> ${result} ($${totalCost})`);
            this.callbacks.unlockIngredient(result, totalCost, [item1Obj, item2Obj]);
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

        let ingredients = null;
        for (let [key, val] of Object.entries(RECIPES)) {
            if (val === item && key.includes("+")) {
                ingredients = key.split("+");
                break;
            }
        }

        if (ingredients) {
            this.callbacks.onLog(`Chopping: ${item} -> ${ingredients[0]} + ${ingredients[1]}`);
            this.state.countertop.splice(this.state.selectedIndices[0], 1);
            this.state.countertop.push(createItemObject(ingredients[0], mods));
            this.state.countertop.push(createItemObject(ingredients[1], mods));
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
        const itemCost = this.callbacks.getAtomCostWithArtifacts(item, baseItemCost);

        if (RECIPES[item] && !item.includes("+")) {
            const result = RECIPES[item];
            this.state.countertop[this.state.selectedIndices[0]] = createItemObject(result, mods);
            this.callbacks.onLog(`Amplified ${item} ($${itemCost}) into ${result} ($${itemCost})!`);
            this.callbacks.unlockIngredient(result, itemCost, [itemObj]);
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
        const itemCost = this.callbacks.getAtomCostWithArtifacts(item, baseItemCost);
        const chance = Math.random();

        this.state.countertop.splice(this.state.selectedIndices[0], 1);

        let result;
        if (RECIPES[item] && (item === "Meat" || item === "Fish" || item === "Egg" || item === "Potato" || item === "Cheese")) {
            result = RECIPES[item];
            this.callbacks.onLog(`Microwave mutated ${item} ($${itemCost}) into ${result} ($${itemCost})!`);
            this.state.countertop.push(createItemObject(result, mods));
            this.callbacks.unlockIngredient(result, itemCost, [itemObj]);
        } else if (chance > 0.7) {
            result = "Radioactive Slime";
            this.callbacks.onLog(`Microwave mutated ${item} ($${itemCost}) into: RADIOACTIVE SLIME ($${itemCost})`, "error");
            this.state.countertop.push(createItemObject(result, mods));
            this.callbacks.unlockIngredient(result, itemCost, [itemObj]);
        } else {
            result = "Hot " + item;
            this.callbacks.onLog(`Microwave made ${item} ($${itemCost}) really hot -> ${result} ($${itemCost})`);
            this.state.countertop.push(createItemObject(result, mods));
            this.callbacks.unlockIngredient(result, itemCost, [itemObj]);
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
