// CustomerManager.js - Customer and serving logic

import { FEEDBACK_CATEGORIES, TASTE_TEST_SANITY_COST, TERRIBLE_SERVICE_SANITY_PENALTY, POOR_SERVICE_SANITY_PENALTY } from '../config.js';
import { getCustomerTypes, getBossForDay } from '../data/DataStore.js';
import { getItemName, getFoodAttributes } from '../utils/ItemUtils.js';
import { getTasteFeedback, getDemandHints } from '../services/FeedbackService.js';
import { calculateDistance, calculatePayment, getSatisfactionRating } from '../services/PaymentService.js';
import { runHook, runEffectHook } from '../effects/EffectHandlerRegistry.js';

export class CustomerManager {
    constructor(gameState, callbacks) {
        this.state = gameState;
        this.callbacks = callbacks;
    }

    advanceCustomer(delay = 1500) {
        this.state.customersServedCount++;
        this.callbacks.onRender();

        if (this.state.customersServedCount >= this.state.customersPerDay) {
            this.callbacks.onEndDay();
        } else {
            setTimeout(() => {
                this.nextCustomer();
            }, delay);
        }
    }

    nextCustomer() {
        if (!this.state.isDayActive) return;
        if (this.state.customer && this.state.customer.isBoss) return;

        // Check if a boss should spawn as the final customer of the day
        const boss = getBossForDay(this.state.day);
        if (boss && !this.state.endlessMode && this.state.customersServedCount === this.state.customersPerDay - 1) {
            this.spawnBoss(boss);
            return;
        }

        const customerTypes = getCustomerTypes();
        const availableCustomers = customerTypes.filter(c => (c.spawnDay || 1) <= this.state.day);
        const template = availableCustomers[Math.floor(Math.random() * availableCustomers.length)];
        this.state.customer = { ...template };

        const orderHints = getDemandHints(this.state.customer.demand);
        this.state.customer.orderHints = orderHints;

        this.callbacks.updateCustomerDisplay(this.state.customer);

        this.callbacks.onLog(`Customer arrived: ${this.state.customer.name}`, "customer");
        this.callbacks.onLog(`They want: ${orderHints}`, "customer");
        this.callbacks.onRender();
    }

    spawnBoss(bossData) {
        this.state.customer = {
            name: bossData.name,
            isBoss: true,
            coursesRequired: bossData.orders.length,
            coursesServed: 0,
            orders: bossData.orders,
            currentCourse: 0,
            avatar: bossData.avatar,
            victoryBonus: bossData.victoryBonus || 0
        };

        this.callbacks.onLog("=== BOSS ARRIVED ===", "narrative");
        this.callbacks.onLog(`${bossData.name.toUpperCase()} - ${bossData.title}`, "narrative");
        this.callbacks.onLog(`They demand a ${bossData.orders.length}-course meal!`, "narrative");
        this.callbacks.onLog("Their standards are IMPOSSIBLY HIGH!", "narrative");
        this.callbacks.onLog("Match their demands closely or face their WRATH!", "narrative");

        this.callbacks.updateBossDisplay(this.state.customer);
        this.callbacks.onRender();
    }

    tasteTest() {
        if (!this.state.isDayActive) return;
        if (this.state.selectedIndices.length !== 1) {
            this.callbacks.onLog("Select 1 item to taste.", "error");
            return;
        }
        const itemObj = this.state.countertop[this.state.selectedIndices[0]];
        const item = getItemName(itemObj);

        // Get food attributes to check for caffeine
        const attrs = getFoodAttributes(itemObj);

        let sanityCost = runHook('modifyTasteTestCost', this.state.activeArtifacts, {
            defaultValue: TASTE_TEST_SANITY_COST,
            attrs,
            sanity: this.state.sanity
        });

        this.state.sanity -= sanityCost;

        this.callbacks.onLog(`=== TASTING '${item.toUpperCase()}' (-${sanityCost} sanity) ===`, "system");

        let hasOutput = false;

        for (const [category, attributes] of Object.entries(FEEDBACK_CATEGORIES)) {
            const messages = [];

            for (const attr of attributes) {
                const value = attrs[attr];
                if (value !== undefined) {
                    const feedback = getTasteFeedback(attr, value);
                    if (feedback) {
                        messages.push(feedback);
                    }
                }
            }

            if (messages.length > 0) {
                let logType = "action";
                if (category === "COSMIC") logType = "narrative";
                if (category === "EFFECT" && messages.some(m => m.includes("TOXIC") || m.includes("SANITY"))) {
                    logType = "narrative";
                }

                this.callbacks.onLog(`${category}: ${messages.join(" ")}`, logType);
                hasOutput = true;
            }
        }

        if (!hasOutput) {
            this.callbacks.onLog("ANALYSIS: Unremarkable. No distinctive traits detected.");
        }

        if (attrs.sanity < 0) {
            const sanityDamage = Math.abs(Math.floor(attrs.sanity));
            this.state.sanity -= sanityDamage;
            this.callbacks.onLog(`The taste damages your sanity! (-${sanityDamage} additional)`, "narrative");
        }

        // Post-taste artifact effects (e.g. caffeine consumption)
        runEffectHook('postTasteTest', this.state.activeArtifacts, {
            attrs,
            state: this.state,
            selectedIndex: this.state.selectedIndices[0],
            restoreSanity: (amount) => this.callbacks.restoreSanity(amount),
            log: (msg, type) => this.callbacks.onLog(msg, type),
            clearSelection: () => this.callbacks.onClearSelection()
        });

        if (this.state.sanity <= 0) {
            this.callbacks.onRender();
            this.callbacks.onGameOver("SANITY DEPLETED");
            return;
        }

        if (this.state.sanity <= 30) {
            this.callbacks.onLog("Reality distorting... (Sanity Critical!)", "narrative");
        } else if (this.state.sanity <= 50) {
            this.callbacks.onLog("Vision blurring... (Sanity Low)", "narrative");
        }

        this.callbacks.onRender();
    }

    serveCustomer() {
        if (!this.state.isDayActive) return;

        // Check if merchant is active - can't serve the merchant!
        if (this.callbacks.isMerchantActive && this.callbacks.isMerchantActive()) {
            this.callbacks.onLog("The merchant doesn't need serving - they're here to serve YOU!", "error");
            return;
        }

        // Guard: can't serve if feedback is pending collection
        if (this.state.pendingFeedback.active) {
            this.callbacks.onLog("Collect payment from current customer first!", "error");
            return;
        }

        if (this.state.selectedIndices.length !== 1) {
            this.callbacks.onLog("Select 1 dish to serve.", "error");
            return;
        }
        const itemObj = this.state.countertop[this.state.selectedIndices[0]];
        const item = getItemName(itemObj);

        if (this.state.customer.isBoss) {
            this.serveBoss(itemObj);
            return;
        }

        // Minimal console log
        this.callbacks.onLog(`Serving ${item} to ${this.state.customer.name}...`, "customer");

        const foodAttrs = getFoodAttributes(itemObj);
        const demandVector = this.state.customer.demand;

        const distance = calculateDistance(foodAttrs, demandVector);
        let payment = calculatePayment(distance);
        let satisfaction = getSatisfactionRating(distance);

        // Apply Golden Plate effect
        const usedGoldenPlate = this.state.activeEffects.goldenPlate;
        if (usedGoldenPlate) {
            satisfaction = { rating: "PERFECT", emoji: "★★★★★", color: "#ffff00" };
            payment = calculatePayment(0);
            this.state.activeEffects.goldenPlate = false;
        }

        const orderHints = getDemandHints(demandVector);

        // Generate comment based on satisfaction
        let comment;
        if (satisfaction.rating === "PERFECT") {
            comment = "PERFECT! This is EXACTLY what I wanted!";
        } else if (satisfaction.rating === "EXCELLENT") {
            comment = "Wonderful! This is great!";
        } else if (satisfaction.rating === "GOOD") {
            comment = "This is pretty good, thanks!";
        } else if (satisfaction.rating === "OKAY") {
            comment = "Hmm... not quite what I imagined, but okay.";
        } else if (satisfaction.rating === "POOR") {
            comment = "This isn't really what I asked for...";
        } else {
            comment = "What IS this?! This is NOTHING like what I wanted!";
        }

        // Calculate sanity cost but DON'T apply it yet
        let sanityCost = 0;
        if (satisfaction.rating === "TERRIBLE") {
            sanityCost = TERRIBLE_SERVICE_SANITY_PENALTY;
        } else if (satisfaction.rating === "POOR") {
            sanityCost = POOR_SERVICE_SANITY_PENALTY;
        }

        // Apply payment bonus artifacts
        const isExcellentOrPerfect = satisfaction.rating === "EXCELLENT" || satisfaction.rating === "PERFECT";

        const paymentResult = runHook('modifyPayment', this.state.activeArtifacts, {
            defaultValue: { multiplier: 1, reasons: [] },
            isExcellentOrPerfect,
            foodAttrs,
            itemName: item
        });

        const appliedBonuses = [];
        if (paymentResult.multiplier > 1) {
            payment *= paymentResult.multiplier;
            appliedBonuses.push(`${paymentResult.reasons.join(" + ")}: ${paymentResult.multiplier}x`);
        }

        // Apply Lucky Coin effect
        if (this.state.activeEffects.luckyCoins > 0) {
            payment *= 2;
            appliedBonuses.push("Lucky Coin: 2x");
            this.state.activeEffects.luckyCoins--;
        }

        // Apply Golden Plate bonus message if used
        if (usedGoldenPlate) {
            appliedBonuses.unshift("Golden Plate: PERFECT rating");
        }

        // Store feedback instead of applying payment/sanity
        this.state.pendingFeedback = {
            active: true,
            isBoss: false,
            dishName: item,
            comment: comment,
            rating: satisfaction,
            payment: Math.floor(payment),
            orderHints: orderHints,
            appliedBonuses: appliedBonuses,
            sanityCost: sanityCost,           // STORED, not applied
            customerName: this.state.customer.name,
            customerAvatar: this.state.customer.avatar,
            buttonText: "COLLECT",
            courseName: ""
        };

        // Remove item, show feedback UI, DON'T advance
        this.state.countertop.splice(this.state.selectedIndices[0], 1);
        this.callbacks.onClearSelection();
        this.callbacks.showFeedbackDisplay(this.state.pendingFeedback);
        this.callbacks.onRender();
    }

    serveBoss(itemObj) {
        // Guard: can't serve if feedback is pending collection
        if (this.state.pendingFeedback.active) {
            this.callbacks.onLog("Complete current course first!", "error");
            return;
        }

        const item = getItemName(itemObj);
        const currentOrder = this.state.customer.orders[this.state.customer.currentCourse];

        // Minimal console log
        this.callbacks.onLog(`Serving ${item} as ${currentOrder.name}...`, "customer");

        const foodAttrs = getFoodAttributes(itemObj);
        const demandVector = currentOrder.demand;

        const distance = calculateDistance(foodAttrs, demandVector);
        const satisfaction = getSatisfactionRating(distance);

        const orderHints = getDemandHints(demandVector);

        // SUCCESS: dish meets boss standards
        if (distance <= currentOrder.maxDistance) {
            const payment = calculatePayment(distance);

            let comment;
            if (satisfaction.rating === "PERFECT") {
                comment = `MAGNIFICENT! This ${currentOrder.name} is PERFECT!`;
            } else if (satisfaction.rating === "EXCELLENT") {
                comment = `Excellent work. This ${currentOrder.name} meets my high standards.`;
            } else {
                comment = `Acceptable. This ${currentOrder.name} will do.`;
            }

            const isLastCourse = (this.state.customer.currentCourse + 1) >= this.state.customer.coursesRequired;
            const buttonText = isLastCourse ? "VICTORY" : "NEXT COURSE";

            // Store feedback for successful course
            this.state.pendingFeedback = {
                active: true,
                isBoss: true,
                dishName: item,
                comment: comment,
                rating: satisfaction,
                payment: Math.floor(payment),
                orderHints: orderHints,
                appliedBonuses: [],
                sanityCost: 0,                    // Boss doesn't penalize sanity
                customerName: this.state.customer.name,
                customerAvatar: this.state.customer.avatar,
                buttonText: buttonText,
                courseName: currentOrder.name.toUpperCase()
            };

            this.state.countertop.splice(this.state.selectedIndices[0], 1);
            this.callbacks.onClearSelection();
            this.callbacks.showFeedbackDisplay(this.state.pendingFeedback);
            this.callbacks.onRender();
        }
        // FAILURE: dish doesn't meet boss standards
        else {
            const comment = `DISGRACEFUL! This is NOTHING like a proper ${currentOrder.name}!`;

            // Store failure feedback
            this.state.pendingFeedback = {
                active: true,
                isBoss: true,
                dishName: item,
                comment: comment,
                rating: satisfaction,
                payment: 0,
                orderHints: orderHints,
                appliedBonuses: [],
                sanityCost: 0,
                customerName: this.state.customer.name,
                customerAvatar: this.state.customer.avatar,
                buttonText: "ACCEPT DEFEAT",
                courseName: currentOrder.name.toUpperCase()
            };

            this.state.countertop.splice(this.state.selectedIndices[0], 1);
            this.callbacks.onClearSelection();
            this.callbacks.showFeedbackDisplay(this.state.pendingFeedback);
            this.callbacks.onRender();
        }
    }

    collectPayment() {
        if (!this.state.pendingFeedback.active) {
            this.callbacks.onLog("No payment to collect.", "error");
            return;
        }

        const feedback = this.state.pendingFeedback;

        // === BOSS FLOW ===
        if (feedback.isBoss) {
            // Apply payment
            if (feedback.payment > 0) {
                this.state.money += feedback.payment;
                this.callbacks.onLog(`Received $${feedback.payment} for ${feedback.courseName}.`, "customer");
            }

            // Check if this was a failure
            if (feedback.buttonText === "ACCEPT DEFEAT") {
                this.callbacks.onLog("CRITICAL FAILURE - BOSS BATTLE LOST!", "narrative");
                this.state.pendingFeedback.active = false;
                this.callbacks.hideFeedbackDisplay();
                this.callbacks.onRender();
                setTimeout(() => {
                    this.callbacks.onGameOver(`${feedback.customerName.toUpperCase()} DEFEATED YOU`);
                }, 1000);
                return;
            }

            // Check if this was victory
            if (feedback.buttonText === "VICTORY") {
                this.state.pendingFeedback.active = false;
                this.callbacks.hideFeedbackDisplay();
                this.callbacks.onRender();
                setTimeout(() => {
                    this.defeatBoss();
                }, 500);
                return;
            }

            // Next course
            this.state.customer.currentCourse++;
            this.state.customer.coursesServed++;
            this.state.pendingFeedback.active = false;
            this.callbacks.hideFeedbackDisplay();
            this.callbacks.onLog(`Next course: ${this.state.customer.orders[this.state.customer.currentCourse].name}`, "customer");
            this.callbacks.updateBossDisplay(this.state.customer);
            this.callbacks.onRender();
            return;
        }

        // === REGULAR CUSTOMER FLOW ===

        // Apply sanity penalty FIRST
        if (feedback.sanityCost > 0) {
            this.state.sanity -= feedback.sanityCost;

            // Check for game over AFTER collecting
            if (this.state.sanity <= 0) {
                this.state.pendingFeedback.active = false;
                this.callbacks.hideFeedbackDisplay();
                this.callbacks.onRender();
                setTimeout(() => {
                    this.callbacks.onGameOver("SANITY DEPLETED");
                }, 1000);
                return;
            }
        }

        // Apply payment
        if (feedback.payment >= 1) {
            this.state.money += feedback.payment;
            this.callbacks.onLog(`Received $${feedback.payment}. ${feedback.customerName} leaves.`, "customer");
        } else if (feedback.payment > 0) {
            this.callbacks.onLog(`Customer left a few cents. ($${feedback.payment.toFixed(2)})`, "customer");
        } else {
            this.callbacks.onLog("Customer refused to pay and left.", "narrative");
        }

        // Run post-serve effects (Meditation Master artifact)
        const isExcellentOrPerfect = feedback.rating.rating === "EXCELLENT" || feedback.rating.rating === "PERFECT";
        runEffectHook('postServe', this.state.activeArtifacts, {
            isExcellentOrPerfect,
            restoreSanity: (amount) => this.callbacks.restoreSanity(amount),
            log: (msg, type) => this.callbacks.onLog(msg, type)
        });

        // Clear feedback state
        this.state.pendingFeedback.active = false;

        // Hide feedback UI
        this.callbacks.hideFeedbackDisplay();

        // Advance to next customer (500ms delay)
        this.advanceCustomer(500);
    }

    defeatBoss() {
        const bossName = this.state.customer.name;
        const victoryBonus = this.state.customer.victoryBonus || 0;

        this.callbacks.onLog(`${bossName}: 'Magnificent! A perfect ${this.state.customer.coursesRequired}-course meal!'`, "narrative");
        this.callbacks.onLog(`${bossName}: 'Your cooking... it's RAW TALENT!'`, "narrative");
        this.callbacks.onLog("=== BOSS DEFEATED ===", "narrative");

        if (victoryBonus > 0) {
            this.state.money += victoryBonus;
            this.callbacks.onLog(`Received $${victoryBonus} BOSS BONUS!`, "customer");
        }

        this.state.customersServedCount++;
        this.callbacks.onRender();

        // Process end-of-day effects before showing victory
        setTimeout(() => {
            this.state.isDayActive = false;
            const result = this.callbacks.onProcessEndOfDayEffects();

            // If player went bankrupt, game over is already shown
            // Only show victory if solvent
            if (!result.bankrupt) {
                setTimeout(() => {
                    this.showVictory(bossName);
                }, 1000);
            }
        }, 2000);
    }

    showVictory(bossName) {
        this.callbacks.onLog(`=== YOU DEFEATED ${bossName.toUpperCase()}! ===`, "system");
        this.callbacks.showVictory(this.state.day, this.state.money, this.state.sanity, bossName);
    }
}
