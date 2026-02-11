// CustomerManager.js - Customer and serving logic

import { FEEDBACK_CATEGORIES, TASTE_TEST_SANITY_COST, TERRIBLE_SERVICE_SANITY_PENALTY, POOR_SERVICE_SANITY_PENALTY, BOSS_FAILURE_SANITY_PENALTY } from '../config.js';
import { getCustomerTypes, getBossForDay, getArtifactById, getConsumables } from '../data/DataStore.js';
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

        // Build combined modifier sources and multiplier
        let combinedMultiplier = paymentResult.multiplier;
        const combinedSources = [...paymentResult.reasons];

        // Apply Lucky Coin effect
        if (this.state.activeEffects.luckyCoins > 0) {
            combinedMultiplier *= 2;
            combinedSources.push("Lucky Coin");
            this.state.activeEffects.luckyCoins--;
        }

        // Apply Golden Plate to sources
        if (usedGoldenPlate) {
            combinedSources.unshift("Golden Plate");
        }

        // Recalculate payment with combined multiplier applied
        payment = calculatePayment(usedGoldenPlate ? 0 : distance) * combinedMultiplier;

        const finalPayment = Math.floor(payment);

        // Build paymentItems array
        const paymentItems = [];

        // Money item
        const moneyModifiers = [];
        if (combinedMultiplier > 1 || usedGoldenPlate) {
            const modLine = `x${combinedMultiplier} from ${combinedSources.join(", ")}`;
            moneyModifiers.push(modLine);
        }
        paymentItems.push({
            label: `+$${finalPayment}`,
            type: "money",
            value: finalPayment,
            binded: false,
            modifiers: moneyModifiers
        });

        // Sanity cost item (only if cost > 0)
        if (sanityCost > 0) {
            paymentItems.push({
                label: `-${sanityCost} sanity`,
                type: "sanity_cost",
                value: sanityCost,
                binded: true,
                modifiers: ["Binded. Cannot press the collect button without selecting this item."]
            });
        }

        // Meditation Master item (if player has artifact AND rating is EXCELLENT/PERFECT)
        if (this.state.activeArtifacts.includes('meditation_master') && isExcellentOrPerfect) {
            const mmArtifact = getArtifactById('meditation_master');
            const sanityRestore = mmArtifact.effect.value;
            paymentItems.push({
                label: `+${sanityRestore} sanity`,
                type: "sanity_restore",
                value: sanityRestore,
                binded: false,
                modifiers: ["Meditation Master"]
            });
        }

        // Consumable reward for EXCELLENT/PERFECT ratings
        if (isExcellentOrPerfect) {
            const allConsumables = getConsumables();
            let eligible;
            if (satisfaction.rating === "PERFECT") {
                eligible = allConsumables.filter(c => c.rarity === "uncommon" || c.rarity === "rare");
            } else {
                eligible = allConsumables.filter(c => c.rarity === "common" || c.rarity === "uncommon");
            }
            if (eligible.length > 0) {
                const picked = eligible[Math.floor(Math.random() * eligible.length)];
                paymentItems.push({
                    label: picked.name,
                    type: "consumable",
                    value: picked.id,
                    binded: false,
                    modifiers: [],
                    consumableInfo: {
                        name: picked.name,
                        description: picked.description,
                        tipText: satisfaction.rating === "PERFECT"
                            ? "A tip from a very satisfied customer"
                            : "A tip from a satisfied customer"
                    }
                });
            }
        }

        // Store feedback instead of applying payment/sanity
        this.state.pendingFeedback = {
            active: true,
            isBoss: false,
            dishName: item,
            comment: comment,
            rating: satisfaction,
            payment: finalPayment,
            orderHints: orderHints,
            paymentItems: paymentItems,
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

        this.callbacks.onLog(`Serving ${item} as ${currentOrder.name}...`, "customer");

        const foodAttrs = getFoodAttributes(itemObj);
        const demandVector = currentOrder.demand;

        const distance = calculateDistance(foodAttrs, demandVector);
        const satisfaction = getSatisfactionRating(distance);
        const isLastCourse = (this.state.customer.currentCourse + 1) >= this.state.customer.coursesRequired;
        const success = distance <= currentOrder.maxDistance;

        // Build paymentItems
        const paymentItems = [];
        let comment;

        if (success) {
            const payment = Math.floor(calculatePayment(distance));

            if (satisfaction.rating === "PERFECT") {
                comment = `MAGNIFICENT! This ${currentOrder.name} is PERFECT!`;
            } else if (satisfaction.rating === "EXCELLENT") {
                comment = `Excellent work. This ${currentOrder.name} meets my high standards.`;
            } else {
                comment = `Acceptable. This ${currentOrder.name} will do.`;
            }

            paymentItems.push({
                label: `+$${payment}`,
                type: "money",
                value: payment,
                binded: false,
                modifiers: []
            });
        } else {
            comment = `DISGRACEFUL! This is NOTHING like a proper ${currentOrder.name}!`;

            paymentItems.push({
                label: `-${BOSS_FAILURE_SANITY_PENALTY} sanity`,
                type: "sanity_cost",
                value: BOSS_FAILURE_SANITY_PENALTY,
                binded: true,
                modifiers: ["Binded. Cannot press the collect button without selecting this item."]
            });
        }

        const buttonText = isLastCourse ? "COMPLETE ORDER" : "NEXT COURSE";

        this.state.pendingFeedback = {
            active: true,
            isBoss: true,
            dishName: item,
            comment: comment,
            rating: satisfaction,
            payment: 0,
            orderHints: getDemandHints(demandVector),
            paymentItems: paymentItems,
            customerName: this.state.customer.name,
            customerAvatar: this.state.customer.avatar,
            buttonText: buttonText,
            courseName: ""
        };

        this.state.countertop.splice(this.state.selectedIndices[0], 1);
        this.callbacks.onClearSelection();
        this.callbacks.showFeedbackDisplay(this.state.pendingFeedback);
        this.callbacks.onRender();
    }

    collectPayment() {
        if (!this.state.pendingFeedback.active) {
            this.callbacks.onLog("No payment to collect.", "error");
            return;
        }

        const feedback = this.state.pendingFeedback;
        const paymentItems = feedback.paymentItems || [];
        const selectedIndices = this.state.selectedPaymentIndices;

        // Check all binded items are selected
        const unselectedBinded = paymentItems.filter((item, i) => item.binded && !selectedIndices.includes(i));
        if (unselectedBinded.length > 0) {
            this.callbacks.onLog("Select all required (binded) items in the payment section to collect.", "error");
            return;
        }

        // Process selected items
        let moneyCollected = false;
        let gameOver = false;

        for (const idx of selectedIndices) {
            const item = paymentItems[idx];
            if (!item) continue;

            if (item.type === "money") {
                this.state.money += item.value;
                if (item.value >= 1) {
                    this.callbacks.onLog(`Received $${item.value}.`, "customer");
                } else if (item.value > 0) {
                    this.callbacks.onLog(`Received a few cents. ($${item.value.toFixed(2)})`, "customer");
                }
                moneyCollected = true;
            } else if (item.type === "sanity_cost") {
                this.state.sanity -= item.value;
                this.callbacks.onLog(`-${item.value} sanity.`, "narrative");
                if (this.state.sanity <= 0) {
                    gameOver = true;
                }
            } else if (item.type === "sanity_restore") {
                this.callbacks.restoreSanity(item.value);
                this.callbacks.onLog(`MEDITATION MASTER: +${item.value} sanity from excellent service!`, "artifact");
            } else if (item.type === "consumable") {
                this.callbacks.grantConsumable(item.value, 1);
                this.callbacks.onLog(`Received ${item.label}!`, "consumable");
            }
        }

        // Skip payment message (only for regular customers with no selection)
        if (!feedback.isBoss && selectedIndices.length === 0) {
            this.callbacks.onLog(`You skipped payment.`, "customer");
        }

        // Clear feedback state
        this.state.pendingFeedback.active = false;
        this.state.selectedPaymentIndices = [];
        this.callbacks.hideFeedbackDisplay();

        // Check for game over after processing
        if (gameOver) {
            this.callbacks.onRender();
            setTimeout(() => {
                this.callbacks.onGameOver("SANITY DEPLETED");
            }, 1000);
            return;
        }

        // === What happens next ===
        if (feedback.isBoss && !feedback.isBossBonus) {
            // Advance to next course or show final bonus page
            this.state.customer.currentCourse++;
            this.state.customer.coursesServed++;

            if (this.state.customer.currentCourse >= this.state.customer.coursesRequired) {
                // All courses done — show final bonus feedback page
                this.showBossBonusFeedback();
            } else {
                // More courses remain
                this.callbacks.onLog(`Next course: ${this.state.customer.orders[this.state.customer.currentCourse].name}`, "customer");
                this.callbacks.updateBossDisplay(this.state.customer);
                this.callbacks.onRender();
            }
        } else if (feedback.isBossBonus) {
            // Final bonus collected — proceed to victory
            this.defeatBoss();
        } else {
            // Regular customer — advance
            this.advanceCustomer(500);
        }
    }

    showBossBonusFeedback() {
        const bossName = this.state.customer.name;
        const victoryBonus = this.state.customer.victoryBonus || 0;

        this.callbacks.onLog("=== BOSS DEFEATED ===", "narrative");

        const paymentItems = [];
        if (victoryBonus > 0) {
            paymentItems.push({
                label: `+$${victoryBonus}`,
                type: "money",
                value: victoryBonus,
                binded: false,
                modifiers: ["Boss Victory Bonus"]
            });
        }

        this.state.pendingFeedback = {
            active: true,
            isBoss: true,
            isBossBonus: true,
            dishName: "",
            comment: `'Magnificent! Your ${this.state.customer.coursesRequired}-course meal was a masterpiece!'`,
            rating: { rating: "PERFECT", emoji: "★★★★★", color: "#ffff00" },
            payment: 0,
            orderHints: "",
            paymentItems: paymentItems,
            customerName: bossName,
            customerAvatar: this.state.customer.avatar,
            buttonText: "COLLECT",
            courseName: ""
        };

        this.callbacks.showFeedbackDisplay(this.state.pendingFeedback);
        this.callbacks.onRender();
    }

    defeatBoss() {
        const bossName = this.state.customer.name;
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
