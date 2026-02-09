// DayManager.js - Day progression and rent management

import { APPLIANCE_UNLOCK_DAYS } from '../config.js';
import { getRecipes, getAtoms, getArtifactById } from '../data/DataStore.js';
import { createItemObject } from '../utils/ItemUtils.js';
import * as UI from '../ui.js';

export class DayManager {
    constructor(gameState, callbacks) {
        this.state = gameState;
        this.callbacks = callbacks;
    }

    endDay() {
        this.state.isDayActive = false;
        this.callbacks.onLog("=== SHIFT ENDED ===", "system");

        if (this.state.countertop.length > 0) {
            this.callbacks.onLog(`Discarded ${this.state.countertop.length} items from countertop.`);
            this.state.countertop = [];
        }

        const sanityRestore = 50;
        this.callbacks.restoreSanity(sanityRestore);
        this.callbacks.onLog(`Sanity restored by ${sanityRestore}%. Current: ${this.state.sanity}%`, "system");

        // Night Owl: Restore sanity if money threshold met
        if (this.callbacks.hasArtifact('night_owl')) {
            const artifact = getArtifactById('night_owl');
            const sanityBonus = artifact.effect.value;
            const moneyThreshold = parseInt(artifact.effect.condition.split('_')[2]) || 50;
            if (this.state.money >= moneyThreshold) {
                this.callbacks.restoreSanity(sanityBonus);
                this.callbacks.onLog(`NIGHT OWL: +${sanityBonus} sanity for having $${moneyThreshold}+!`, "system");
            }
        }

        // Investment Portfolio: Earn interest
        if (this.callbacks.hasArtifact('investment_portfolio')) {
            const artifact = getArtifactById('investment_portfolio');
            const rate = artifact.effect.rate;
            const maxInterest = artifact.effect.max;
            const interest = Math.min(maxInterest, Math.floor(this.state.money * rate));
            if (interest > 0) {
                this.state.money += interest;
                this.callbacks.onLog(`INVESTMENT PORTFOLIO: Earned $${interest} interest!`, "system");
            }
        }

        this.callbacks.onLog(`Deducting Rent: -$${this.state.rent}`);
        this.state.money -= this.state.rent;
        this.callbacks.onRender();

        if (this.state.money < 0) {
            this.callbacks.onGameOver("BANKRUPT");
            return;
        }

        // Show artifact selection if (before day 5 OR in endless mode) and pool has artifacts
        if ((this.state.day < 5 || this.state.endlessMode) && this.state.artifactPool.length > 0) {
            setTimeout(() => this.callbacks.showArtifactSelection(), 2000);
        } else {
            setTimeout(() => this.startNextDay(), 3000);
        }
    }

    startNextDay() {
        this.state.day++;
        this.state.customersServedCount = 0;

        // Rent Negotiator: Freeze rent increase if artifact is active and within freeze period
        if (this.state.day <= this.state.rentFrozenUntilDay) {
            this.callbacks.onLog(`RENT NEGOTIATOR: Rent increase frozen this day!`, "system");
        } else {
            this.state.rent = Math.floor(this.state.rent * 1.333);
        }

        this.state.customersPerDay = 5;

        this.callbacks.onLog(`=== STARTING DAY ${this.state.day} ===`, "system");
        this.callbacks.onLog(`Rent due at end of shift: $${this.state.rent}. Customer Quota: ${this.state.customersPerDay}`);

        const applianceNames = { board: 'BOARD', amp: 'AMPLIFIER', micro: 'MICROWAVE' };
        for (const [appliance, unlockDay] of Object.entries(APPLIANCE_UNLOCK_DAYS)) {
            if (unlockDay === this.state.day && applianceNames[appliance]) {
                this.callbacks.onLog(`NEW APPLIANCE UNLOCKED: [${applianceNames[appliance]}]!`, "system");
            }
        }

        // Morning Prep: Add random items
        if (this.callbacks.hasArtifact('morning_prep')) {
            const artifact = getArtifactById('morning_prep');
            const numItems = artifact.effect.value;
            const capacity = this.callbacks.getCountertopCapacity();
            const spaceAvailable = capacity - this.state.countertop.length;
            const itemsToAdd = Math.min(numItems, spaceAvailable);

            if (itemsToAdd > 0) {
                const RECIPES = getRecipes();
                const atoms = getAtoms();
                const recipeResults = [...new Set(Object.values(RECIPES))];
                const allFoods = [...atoms, ...recipeResults];

                for (let i = 0; i < itemsToAdd; i++) {
                    const randomItem = allFoods[Math.floor(Math.random() * allFoods.length)];
                    // Apply temporary modifier instead of Set tracking
                    this.state.countertop.push(createItemObject(randomItem, { temporary: 1 }));
                }

                this.callbacks.onLog(`MORNING PREP: Added ${itemsToAdd} temporary ingredient(s) to countertop!`, "system");
            }
        }

        this.state.isDayActive = true;
        this.callbacks.onRender();

        // Show Morning Merchant on Day 2+, then spawn customers
        if (this.state.day >= 2) {
            this.callbacks.onShowMerchant();
        } else {
            this.callbacks.onNextCustomer();
        }
    }

    gameOver(reason) {
        this.state.isDayActive = false;
        this.callbacks.onLog(`GAME OVER: ${reason}`, "error");
        const totalServed = this.state.customersServedCount + (this.state.day - 1) * 3;
        UI.showGameOver(reason, this.state.day, totalServed);
    }
}
