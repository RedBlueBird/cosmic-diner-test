// DayManager.js - Day progression and rent management

import { APPLIANCE_UNLOCK_DAYS, CUSTOMERS_PER_DAY, RENT_MULTIPLIER, END_OF_DAY_SANITY_RESTORE, GORDON_BOSS_DAY, MERCHANT_START_DAY } from '../config.js';
import { runEffectHook } from '../effects/EffectHandlerRegistry.js';

export class DayManager {
    constructor(gameState, callbacks) {
        this.state = gameState;
        this.callbacks = callbacks;
    }

    processEndOfDayEffects() {
        this.callbacks.onLog("=== SHIFT ENDED ===", "system");

        if (this.state.countertop.length > 0) {
            this.callbacks.onLog(`Discarded ${this.state.countertop.length} items from countertop.`);
            this.state.countertop = [];
        }

        this.callbacks.restoreSanity(END_OF_DAY_SANITY_RESTORE);
        this.callbacks.onLog(`Sanity restored by ${END_OF_DAY_SANITY_RESTORE}%. Current: ${this.state.sanity}%`, "system");

        // End-of-day artifact effects (night_owl, investment_portfolio)
        runEffectHook('endOfDay', this.state.activeArtifacts, {
            state: this.state,
            restoreSanity: (amount) => this.callbacks.restoreSanity(amount),
            log: (msg, type) => this.callbacks.onLog(msg, type)
        });

        this.callbacks.onLog(`Deducting Rent: -$${this.state.rent}`);
        this.state.money -= this.state.rent;
        this.callbacks.onRender();

        if (this.state.money < 0) {
            this.callbacks.onGameOver("BANKRUPT");
            return { bankrupt: true };
        }

        return { bankrupt: false };
    }

    endDay() {
        this.state.isDayActive = false;

        // Process end-of-day effects (rent, sanity, artifacts, bankruptcy)
        const result = this.processEndOfDayEffects();
        if (result.bankrupt) {
            return; // Game over already triggered
        }

        // Show artifact selection if (before day 5 OR in endless mode) and pool has artifacts
        if ((this.state.day < GORDON_BOSS_DAY || this.state.endlessMode) && this.state.artifactPool.length > 0) {
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
            this.state.rent = Math.floor(this.state.rent * RENT_MULTIPLIER);
        }

        this.state.customersPerDay = CUSTOMERS_PER_DAY;

        this.callbacks.onLog(`=== STARTING DAY ${this.state.day} ===`, "system");
        this.callbacks.onLog(`Rent due at end of shift: $${this.state.rent}. Customer Quota: ${this.state.customersPerDay}`);

        const applianceNames = { board: 'BOARD', amp: 'AMPLIFIER', micro: 'MICROWAVE' };
        for (const [appliance, unlockDay] of Object.entries(APPLIANCE_UNLOCK_DAYS)) {
            if (unlockDay === this.state.day && applianceNames[appliance]) {
                this.callbacks.onLog(`NEW APPLIANCE UNLOCKED: [${applianceNames[appliance]}]!`, "system");
            }
        }

        // Start-of-day artifact effects (morning_prep)
        runEffectHook('startOfDay', this.state.activeArtifacts, {
            state: this.state,
            addToCountertop: (item, mods, silent) => this.callbacks.addToCountertop(item, mods, silent),
            log: (msg, type) => this.callbacks.onLog(msg, type)
        });

        this.state.isDayActive = true;
        this.callbacks.onRender();

        // Show Morning Merchant on Day 2+, then spawn customers
        if (this.state.day >= MERCHANT_START_DAY) {
            this.callbacks.onShowMerchant();
        } else {
            this.callbacks.onNextCustomer();
        }
    }

    gameOver(reason) {
        this.state.isDayActive = false;
        this.callbacks.onLog(`GAME OVER: ${reason}`, "error");
        const totalServed = this.state.customersServedCount + (this.state.day - 1) * 3;
        this.callbacks.showGameOver(reason, this.state.day, totalServed);
    }
}
