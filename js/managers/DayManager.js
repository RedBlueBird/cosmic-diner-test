// DayManager.js - Day progression and rent management

import { APPLIANCE_UNLOCK_DAYS, CUSTOMERS_PER_DAY, RENT_MULTIPLIER, END_OF_DAY_SANITY_RESTORE, MERCHANT_START_DAY } from '../config.js';
import { runHook, runEffectHook } from '../effects/EffectHandlerRegistry.js';

export class DayManager {
    constructor(gameState, callbacks) {
        this.state = gameState;
        this.callbacks = callbacks;
    }

    processEndOfDayEffects() {
        this.callbacks.onLog("=== SHIFT ENDED ===", "system");

        this.callbacks.restoreSanity(END_OF_DAY_SANITY_RESTORE);
        this.callbacks.onLog(`Sanity restored by ${END_OF_DAY_SANITY_RESTORE}%. Current: ${this.state.sanity}%`, "system");

        // End-of-day artifact effects (waste_not_want_not runs here before countertop cleared)
        runEffectHook('endOfDay', this.state.activeArtifacts, {
            state: this.state,
            restoreSanity: (amount) => this.callbacks.restoreSanity(amount),
            log: (msg, type) => this.callbacks.onLog(msg, type)
        });

        // Clear any remaining countertop items after artifacts had a chance to recycle them
        if (this.state.countertop.length > 0) {
            this.callbacks.onLog(`Discarded ${this.state.countertop.length} items from countertop.`);
            this.state.countertop = [];
        }

        this.callbacks.onLog(`Deducting Rent: -$${this.state.rent}`);
        this.state.money -= this.state.rent;
        this.callbacks.onRender();

        if (this.state.money < 0) {
            const prevented = runHook('preventBankruptcy', this.state.activeArtifacts, {
                defaultValue: false,
                state: this.state,
                log: (msg, type) => this.callbacks.onLog(msg, type)
            });
            if (!prevented) {
                this.callbacks.onGameOver("BANKRUPT");
                return { bankrupt: true };
            }
            if (this.state.money < 0) this.state.money = 0;
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

        // Show artifact selection if pool has artifacts
        // (Boss days handle their own end-of-day flow via defeatBoss, so endDay is only called on non-boss days)
        if (this.state.artifactPool.length > 0) {
            setTimeout(() => this.callbacks.showArtifactSelection(), 500);
        } else {
            setTimeout(() => this.startNextDay(), 500);
        }
    }

    startNextDay() {
        this.state.day++;
        this.state.customersServedCount = 0;
        this.state.customer = null;

        // Rent Negotiator: Freeze rent increase if artifact is active and within freeze period
        if (this.state.day <= this.state.rentFrozenUntilDay) {
            this.callbacks.onLog(`RENT NEGOTIATOR: Rent increase frozen this day!`, "artifact");
        } else {
            this.state.rent = Math.floor(this.state.rent * RENT_MULTIPLIER);
        }

        this.state.customersPerDay = runHook('getCustomersPerDay', this.state.activeArtifacts, {
            defaultValue: CUSTOMERS_PER_DAY
        });

        this.callbacks.onLog(`=== STARTING DAY ${this.state.day} ===`, "system");
        this.callbacks.onLog(`Rent due at end of shift: $${this.state.rent}. Customer Quota: ${this.state.customersPerDay}`);

        const applianceNames = { board: 'BOARD', amp: 'AMPLIFIER', micro: 'MICROWAVE' };
        for (const [appliance, unlockDay] of Object.entries(APPLIANCE_UNLOCK_DAYS)) {
            if (unlockDay === this.state.day && applianceNames[appliance]) {
                this.callbacks.onLog(`New appliance unlocked: [${applianceNames[appliance]}]!`, "system");
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
        this.callbacks.onLog(`GAME OVER: ${reason}`, "narrative");
        const totalServed = this.state.customersServedCount + (this.state.day - 1) * 3;
        this.callbacks.showGameOver(reason, this.state.day, totalServed);
    }
}
