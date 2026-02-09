// CustomerManager.js - Customer and serving logic

import { FEEDBACK_CATEGORIES, GORDON_G_CONFIG, TASTE_TEST_SANITY_COST, TERRIBLE_SERVICE_SANITY_PENALTY, POOR_SERVICE_SANITY_PENALTY, GORDON_BASE_BONUS, GORDON_VICTORY_BONUS } from '../config.js';
import { getCustomerTypes } from '../data/DataStore.js';
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

        // Check if this is the final customer of Day 5 (Gordon G boss fight)
        // Gordon G only appears on Day 5 and not in endless mode
        if (this.state.day === 5 && !this.state.endlessMode && this.state.customersServedCount === this.state.customersPerDay - 1) {
            this.spawnGordonG();
            return;
        }

        const customerTypes = getCustomerTypes();
        const availableCustomers = customerTypes.filter(c => (c.spawnDay || 1) <= this.state.day);
        const template = availableCustomers[Math.floor(Math.random() * availableCustomers.length)];
        this.state.customer = { ...template };

        const orderHints = getDemandHints(this.state.customer.demand);
        this.state.customer.orderHints = orderHints;

        this.callbacks.updateCustomerDisplay(this.state.customer);

        this.callbacks.onLog(`CUSTOMER ARRIVED: ${this.state.customer.name}`);
        this.callbacks.onLog(`They want: ${orderHints}`);
        this.callbacks.onRender();
    }

    spawnGordonG() {
        this.state.customer = {
            name: GORDON_G_CONFIG.name,
            isBoss: true,
            coursesRequired: GORDON_G_CONFIG.coursesRequired,
            coursesServed: 0,
            orders: GORDON_G_CONFIG.orders,
            currentCourse: 0,
            avatar: GORDON_G_CONFIG.avatar
        };

        this.callbacks.onLog("======================", "system");
        this.callbacks.onLog("BOSS CUSTOMER ARRIVED!", "system");
        this.callbacks.onLog("GORDON G. SCOWLING - FOOD CRITIC", "system");
        this.callbacks.onLog("======================", "system");
        this.callbacks.onLog("He demands a 3-COURSE MEAL!", "design");
        this.callbacks.onLog("His standards are IMPOSSIBLY HIGH!", "design");
        this.callbacks.onLog("Match his demands closely or face his WRATH!", "design");

        this.callbacks.updateGordonDisplay(this.state.customer);
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

        this.callbacks.onLog(`=== TASTING '${item.toUpperCase()}' ===`, "system");

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
                let logType = "neutral";
                if (category === "COSMIC") logType = "design";
                if (category === "EFFECT" && messages.some(m => m.includes("TOXIC") || m.includes("SANITY"))) {
                    logType = "error";
                }

                this.callbacks.onLog(`${category}: ${messages.join(" ")}`, logType);
                hasOutput = true;
            }
        }

        if (!hasOutput) {
            this.callbacks.onLog("ANALYSIS: Unremarkable. No distinctive traits detected.");
        }

        this.callbacks.onLog("===================================", "system");

        if (attrs.sanity < 0) {
            const sanityDamage = Math.abs(Math.floor(attrs.sanity));
            this.state.sanity -= sanityDamage;
            this.callbacks.onLog(`The taste damages your sanity! (-${sanityDamage} additional)`, "error");
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
            this.callbacks.onGameOver("SANITY DEPLETED");
            return;
        }

        if (this.state.sanity <= 30) {
            this.callbacks.onLog("Reality distorting... (Sanity Critical!)", "design");
        } else if (this.state.sanity <= 50) {
            this.callbacks.onLog("Vision blurring... (Sanity Low)", "design");
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

        if (this.state.selectedIndices.length !== 1) {
            this.callbacks.onLog("Select 1 dish to serve.", "error");
            return;
        }
        const itemObj = this.state.countertop[this.state.selectedIndices[0]];
        const item = getItemName(itemObj);

        if (this.state.customer.isBoss) {
            this.serveGordonG(itemObj);
            return;
        }

        this.callbacks.onLog(`=== SERVING ${item.toUpperCase()} ===`, "system");

        const foodAttrs = getFoodAttributes(itemObj);
        const demandVector = this.state.customer.demand;

        const distance = calculateDistance(foodAttrs, demandVector);
        let payment = calculatePayment(distance);
        let satisfaction = getSatisfactionRating(distance);

        // Apply Golden Plate effect
        if (this.state.activeEffects.goldenPlate) {
            satisfaction = { rating: "PERFECT", emoji: "★★★★★", color: "#ffff00" };
            payment = calculatePayment(0);
            this.callbacks.onLog("GOLDEN PLATE: Automatic PERFECT rating!", "system");
            this.state.activeEffects.goldenPlate = false;
        }

        const orderHints = getDemandHints(demandVector);
        this.callbacks.onLog(`Order: ${orderHints}`);

        this.callbacks.onLog(`${this.state.customer.name} examines the ${item}...`);

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
        this.callbacks.onLog(`Comment: "${comment}"`);

        this.callbacks.onLog(`Rating: ${satisfaction.emoji} ${satisfaction.rating}`);

        // Sanity penalty for poor service
        if (satisfaction.rating === "TERRIBLE") {
            this.state.sanity -= TERRIBLE_SERVICE_SANITY_PENALTY;
            this.callbacks.onLog(`Customer's disgust damages your sanity! (-${TERRIBLE_SERVICE_SANITY_PENALTY} sanity)`, "error");
        } else if (satisfaction.rating === "POOR") {
            this.state.sanity -= POOR_SERVICE_SANITY_PENALTY;
            this.callbacks.onLog(`Customer's disappointment weighs on you. (-${POOR_SERVICE_SANITY_PENALTY} sanity)`, "error");
        }

        // Check for sanity game over
        if (this.state.sanity <= 0) {
            this.callbacks.onRender();
            setTimeout(() => {
                this.callbacks.onGameOver("SANITY DEPLETED");
            }, 1000);
            return;
        }

        // Apply payment bonus artifacts
        const isExcellentOrPerfect = satisfaction.rating === "EXCELLENT" || satisfaction.rating === "PERFECT";

        const paymentResult = runHook('modifyPayment', this.state.activeArtifacts, {
            defaultValue: { multiplier: 1, reasons: [] },
            isExcellentOrPerfect,
            foodAttrs,
            itemName: item
        });

        if (paymentResult.multiplier > 1) {
            payment *= paymentResult.multiplier;
            this.callbacks.onLog(`BONUS (${paymentResult.reasons.join(" + ")}): ${paymentResult.multiplier}x payment!`, "system");
        }

        // Apply Lucky Coin effect
        if (this.state.activeEffects.luckyCoins > 0) {
            payment *= 2;
            this.callbacks.onLog("LUCKY COIN: Payment doubled!", "system");
            this.state.activeEffects.luckyCoins--;
        }

        if (payment >= 1) {
            this.state.money += Math.floor(payment);
            this.callbacks.onLog(`Received $${Math.floor(payment)}.`, "system");
        } else if (payment > 0) {
            this.callbacks.onLog(`Customer left a few cents. ($${payment.toFixed(2)})`);
        } else {
            this.callbacks.onLog("Customer refused to pay.", "error");
        }

        // Post-serve artifact effects (e.g. meditation master)
        runEffectHook('postServe', this.state.activeArtifacts, {
            isExcellentOrPerfect,
            restoreSanity: (amount) => this.callbacks.restoreSanity(amount),
            log: (msg, type) => this.callbacks.onLog(msg, type)
        });

        this.callbacks.onLog("===================================", "system");

        this.state.countertop.splice(this.state.selectedIndices[0], 1);
        this.callbacks.onClearSelection();

        this.advanceCustomer();
    }

    serveGordonG(itemObj) {
        const item = getItemName(itemObj);
        const currentOrder = this.state.customer.orders[this.state.customer.currentCourse];

        this.callbacks.onLog(`=== SERVING ${item.toUpperCase()} AS ${currentOrder.name.toUpperCase()} ===`, "system");

        const foodAttrs = getFoodAttributes(itemObj);
        const demandVector = currentOrder.demand;

        const distance = calculateDistance(foodAttrs, demandVector);
        const satisfaction = getSatisfactionRating(distance);

        const orderHints = getDemandHints(demandVector);
        this.callbacks.onLog(`Order: ${orderHints}`);

        this.callbacks.onLog(`Gordon G. scrutinizes the ${item} intensely...`);

        if (distance <= currentOrder.maxDistance) {
            const baseBonus = GORDON_BASE_BONUS;
            const perfectBonus = distance <= 3 ? 15 : (distance <= 5 ? 10 : 5);
            const totalBonus = baseBonus + perfectBonus;

            let comment;
            if (distance <= 3) {
                comment = `MAGNIFICENT! This ${currentOrder.name} is PERFECT!`;
            } else if (distance <= 5) {
                comment = `Excellent work. This ${currentOrder.name} meets my high standards.`;
            } else {
                comment = `Acceptable. This ${currentOrder.name} will do.`;
            }
            this.callbacks.onLog(`Comment: "${comment}"`, "system");

            this.callbacks.onLog(`Rating: ${satisfaction.emoji} ${satisfaction.rating}`);
            this.state.money += totalBonus;
            this.callbacks.onLog(`Received $${totalBonus}.`, "system");

            this.state.customer.currentCourse++;
            this.state.customer.coursesServed++;

            this.state.countertop.splice(this.state.selectedIndices[0], 1);
            this.callbacks.onClearSelection();
            this.callbacks.onRender();

            if (this.state.customer.coursesServed >= this.state.customer.coursesRequired) {
                setTimeout(() => {
                    this.defeatGordonG();
                }, 1500);
            } else {
                setTimeout(() => {
                    this.callbacks.onLog(`===================================`, "system");
                    this.callbacks.onLog(`Next course: ${this.state.customer.orders[this.state.customer.currentCourse].name}`, "system");
                    this.callbacks.updateGordonDisplay(this.state.customer);
                    this.callbacks.onRender();
                }, 1500);
            }
        } else {
            this.callbacks.onLog(`Comment: "DISGRACEFUL! This is NOTHING like a proper ${currentOrder.name}!"`, "error");
            this.callbacks.onLog(`Rating: ${satisfaction.emoji} ${satisfaction.rating}`, "error");
            this.callbacks.onLog("Gordon G smashes his clipboard on the table!", "error");
            this.callbacks.onLog("CRITICAL FAILURE - BOSS BATTLE LOST!", "error");

            this.state.countertop.splice(this.state.selectedIndices[0], 1);
            this.callbacks.onClearSelection();
            this.callbacks.onRender();

            setTimeout(() => {
                this.callbacks.onGameOver("GORDON G DEFEATED YOU");
            }, 2000);
        }
    }

    defeatGordonG() {
        this.callbacks.onLog("======================", "system");
        this.callbacks.onLog("GORDON G: 'Magnificent! A perfect 3-course meal!'", "system");
        this.callbacks.onLog("GORDON G: 'Your cooking... it's RAW TALENT!'", "system");
        this.callbacks.onLog("======================", "system");
        this.callbacks.onLog("BOSS DEFEATED!", "system");

        this.state.money += GORDON_VICTORY_BONUS;
        this.callbacks.onLog(`Received $${GORDON_VICTORY_BONUS} BOSS BONUS!`);

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
                    this.showVictory();
                }, 1000);
            }
        }, 2000);
    }

    showVictory() {
        this.callbacks.onLog("=== YOU DEFEATED GORDON G! ===", "system");
        this.callbacks.showVictory(this.state.day, this.state.money, this.state.sanity);
    }
}
