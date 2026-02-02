import { APPLIANCE_UNLOCK_DAYS, FEEDBACK_CATEGORIES, GORDON_G_CONFIG } from './config.js';
import {
    getRecipes, getAtoms, getCustomerTypes, getArtifacts, getArtifactById,
    getFoodAttributes, getTasteFeedback,
    calculateDistance, calculatePayment, getSatisfactionRating, getDemandHints, isSimpleDish
} from './utils.js';
import * as UI from './ui.js';

export class Game {
    constructor() {
        this.money = 50;
        this.sanity = 100;
        this.day = 1;
        this.rent = 30;

        this.customersPerDay = 3;
        this.customersServedCount = 0;
        this.isDayActive = true;

        this.countertop = [];
        this.selectedIndices = [];

        // Initialize the ingredient deck with 6 random basic ingredients
        this.availableIngredients = [];
        this.ingredientCosts = {};
        this.initializeIngredientDeck();

        // Artifact system
        this.activeArtifacts = [];      // Array of collected artifact IDs
        this.artifactPool = [];          // Available artifact IDs for selection
        this.purchaseHistory = {};       // For Bulk Buyer: {itemName: count}
        this.rentFrozenUntilDay = 0;     // For Rent Negotiator tracking
        this.morningPrepItems = new Set(); // Track items from Morning Prep (cannot unlock recipes)

        this.log("DAY 1 INITIALIZED.");
        this.log("RENT DUE END OF SHIFT: $" + this.rent);

        this.customer = null;
        this.nextCustomer();

        // Initialize Chef's Intuition hover behavior
        this.initChefIntuitionHover();
    }

    // Randomly select 6 ingredients from the basic ATOMS for this run
    initializeIngredientDeck() {
        const atoms = getAtoms();
        const shuffled = [...atoms].sort(() => Math.random() - 0.5);
        this.availableIngredients = shuffled.slice(0, 6);
        // Set $1 cost for each basic atom ingredient
        this.availableIngredients.forEach(atom => {
            this.ingredientCosts[atom] = 1;
        });
        const stockList = this.availableIngredients.map(a => `${a} ($1)`).join(", ");
        this.log("FRIDGE STOCKED WITH: " + stockList, "system");
    }

    // Get the cost of an ingredient (returns 1 for unknown items)
    getIngredientCost(item) {
        return this.ingredientCosts[item] || 1;
    }

    // Add a newly crafted item to available ingredients with cost tracking
    unlockIngredient(item, cost) {
        if (!this.availableIngredients.includes(item)) {
            this.availableIngredients.push(item);
            this.ingredientCosts[item] = cost;
            this.log(`NEW RECIPE UNLOCKED: ${item} ($${cost}) now available in Fridge!`, "system");
        } else if (cost < this.ingredientCosts[item]) {
            const oldCost = this.ingredientCosts[item];
            this.ingredientCosts[item] = cost;
            this.log(`CHEAPER RECIPE FOR ${item.toUpperCase()} UNLOCKED! $${oldCost} -> $${cost}`, "system");
        }
    }

    // Check if an appliance is unlocked based on current day
    isApplianceUnlocked(appliance) {
        return this.day >= APPLIANCE_UNLOCK_DAYS[appliance];
    }

    log(msg, type = "neutral") {
        UI.log(msg, type);
    }

    // --- Artifact Helper Methods ---

    initializeArtifactPool() {
        const artifacts = getArtifacts();
        this.artifactPool = artifacts.map(a => a.id);
    }

    hasArtifact(artifactId) {
        return this.activeArtifacts.includes(artifactId);
    }

    getMaxSanity() {
        if (this.hasArtifact('stoics_resolve')) {
            const artifact = getArtifactById('stoics_resolve');
            return artifact.effect.value;
        }
        return 100;
    }

    getCountertopCapacity() {
        if (this.hasArtifact('expanded_countertop')) {
            const artifact = getArtifactById('expanded_countertop');
            return artifact.effect.value;
        }
        return 8;
    }

    getAtomCostWithArtifacts(item, baseCost) {
        // Penny Pincher: All atoms cost fixed price
        if (this.hasArtifact('penny_pincher')) {
            const artifact = getArtifactById('penny_pincher');
            return artifact.effect.value;
        }

        // Price Gouger: Atoms cost extra
        if (this.hasArtifact('price_gouger')) {
            const artifact = getArtifactById('price_gouger');
            return baseCost + artifact.effect.costIncrease;
        }

        return baseCost;
    }

    applyBulkDiscount(item, cost) {
        if (!this.hasArtifact('bulk_buyer')) {
            return cost;
        }

        const artifact = getArtifactById('bulk_buyer');
        const freeEveryNth = artifact.effect.value; // e.g., 3 for every 3rd

        // Track purchase history
        if (!this.purchaseHistory[item]) {
            this.purchaseHistory[item] = 0;
        }
        this.purchaseHistory[item]++;

        // Every Nth purchase is free
        if (this.purchaseHistory[item] % freeEveryNth === 0) {
            this.log(`BULK BUYER: ${item} is FREE! (${freeEveryNth}${this.getOrdinalSuffix(freeEveryNth)} purchase)`, "system");
            return 0;
        }

        return cost;
    }

    getOrdinalSuffix(n) {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }

    // Initialize Chef's Intuition hover behavior on PAN button
    initChefIntuitionHover() {
        const panButton = document.getElementById('btn-pan');
        if (!panButton) return;

        // Make button position relative for tooltip positioning
        panButton.style.position = 'relative';

        panButton.addEventListener('mouseenter', () => {
            // Only show tooltip if Chef's Intuition is active
            if (!this.hasArtifact('chefs_intuition')) return;

            // Check if exactly 2 items are selected
            if (this.selectedIndices.length !== 2) return;

            const item1 = this.countertop[this.selectedIndices[0]];
            const item2 = this.countertop[this.selectedIndices[1]];
            const key = item1 + "+" + item2;
            const RECIPES = getRecipes();

            // Check if recipe exists
            const result = RECIPES[key];

            // Create tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'appliance-tooltip';
            tooltip.id = 'chef-intuition-tooltip';

            if (result) {
                tooltip.classList.add('success');
                tooltip.textContent = '✓ This might work...';
            } else {
                tooltip.classList.add('fail');
                tooltip.textContent = '✗ This will fail...';
            }

            panButton.appendChild(tooltip);
        });

        panButton.addEventListener('mouseleave', () => {
            const tooltip = document.getElementById('chef-intuition-tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        });
    }

    nextCustomer() {
        if (!this.isDayActive) return;

        // Check if this is the final customer of Day 5 (Gordon G boss fight)
        if (this.day === 5 && this.customersServedCount === this.customersPerDay - 1) {
            this.spawnGordonG();
            return;
        }

        // Filter customers by spawnDay
        const customerTypes = getCustomerTypes();
        const availableCustomers = customerTypes.filter(c => (c.spawnDay || 1) <= this.day);
        const template = availableCustomers[Math.floor(Math.random() * availableCustomers.length)];
        this.customer = { ...template };

        const orderHints = getDemandHints(this.customer.demand);
        this.customer.orderHints = orderHints;

        UI.updateCustomerDisplay(this.customer);

        this.log(`CUSTOMER ARRIVED: ${this.customer.name}`);
        this.log(`They want: ${orderHints}`);
        this.render();
    }

    spawnGordonG() {
        this.customer = {
            name: GORDON_G_CONFIG.name,
            isBoss: true,
            coursesRequired: GORDON_G_CONFIG.coursesRequired,
            coursesServed: 0,
            orders: GORDON_G_CONFIG.orders,
            currentCourse: 0,
            avatar: GORDON_G_CONFIG.avatar
        };

        this.log("======================", "system");
        this.log("BOSS CUSTOMER ARRIVED!", "system");
        this.log("GORDON G. SCOWLING - FOOD CRITIC", "system");
        this.log("======================", "system");
        this.log("He demands a 3-COURSE MEAL!", "design");
        this.log("His standards are IMPOSSIBLY HIGH!", "design");
        this.log("Match his demands closely or face his WRATH!", "design");

        UI.updateGordonDisplay(this.customer);
        this.render();
    }

    // --- Actions ---

    useFridge() {
        if (!this.isDayActive) return;

        // Calculate adjusted costs for display (with artifacts applied)
        const displayCosts = {};
        this.availableIngredients.forEach(item => {
            const baseCost = this.ingredientCosts[item] || 1;
            displayCosts[item] = this.getAtomCostWithArtifacts(item, baseCost);
        });

        UI.showFridgeModal(
            this.availableIngredients,
            displayCosts,
            this.money,
            (item) => this.withdrawItem(item)
        );
    }

    closeFridge() {
        UI.hideFridgeModal();
    }

    withdrawItem(item) {
        const capacity = this.getCountertopCapacity();
        if (this.countertop.length >= capacity) {
            this.log("Countertop is full!", "error");
            this.closeFridge();
            return;
        }

        const baseCost = this.getIngredientCost(item);
        let cost = this.getAtomCostWithArtifacts(item, baseCost);
        cost = this.applyBulkDiscount(item, cost);

        if (this.money < cost) {
            this.log(`Cannot afford ${item} ($${cost})! You have $${this.money}.`, "error");
            this.closeFridge();
            return;
        }

        this.money -= cost;
        this.countertop.push(item);
        this.log(`Withdrew ${item} from Fridge. -$${cost}`);
        this.render();
        this.closeFridge();
    }

    usePan() {
        if (!this.isDayActive) return;
        if (this.selectedIndices.length !== 2) {
            this.log("PAN requires exactly 2 items selected.", "error");
            return;
        }

        const RECIPES = getRecipes();
        const item1 = this.countertop[this.selectedIndices[0]];
        const item2 = this.countertop[this.selectedIndices[1]];
        const key = item1 + "+" + item2;

        let cost1 = this.getIngredientCost(item1);
        let cost2 = this.getIngredientCost(item2);

        // Pan Perfectionist: Reduce ingredient costs (min $1)
        if (this.hasArtifact('pan_perfectionist')) {
            const artifact = getArtifactById('pan_perfectionist');
            const reduction = artifact.effect.value; // e.g., 0.5 for 50% reduction
            cost1 = Math.max(1, Math.ceil(cost1 * reduction));
            cost2 = Math.max(1, Math.ceil(cost2 * reduction));
            const percent = Math.round((1 - reduction) * 100);
            this.log(`PAN PERFECTIONIST: Ingredient costs reduced by ${percent}%!`, "system");
        }

        const totalCost = cost1 + cost2;

        let result = RECIPES[key];

        if (!result) {
            result = "Burnt Slop";
            this.log(`Failed Combo: ${item1} + ${item2} = ${result}`, "error");
        } else {
            this.log(`Cooking: ${item1} ($${cost1}) + ${item2} ($${cost2}) -> ${result} ($${totalCost})`);

            // Check if any ingredient is from Morning Prep (if so, don't unlock recipe)
            const usesMorningPrepItem = this.morningPrepItems.has(item1) || this.morningPrepItems.has(item2);
            if (!usesMorningPrepItem) {
                this.unlockIngredient(result, totalCost);
            } else {
                this.log("(Cannot unlock recipe - uses temporary Morning Prep ingredient)", "system");
            }
        }

        this.selectedIndices.sort((a, b) => b - a);
        this.countertop.splice(this.selectedIndices[0], 1);
        this.countertop.splice(this.selectedIndices[1], 1);
        this.countertop.push(result);
        this.clearSelection();
        this.render();
    }

    useBoard() {
        if (!this.isDayActive) return;
        if (this.selectedIndices.length !== 1) {
            this.log("CHOPPING BOARD requires 1 item selected.", "error");
            return;
        }

        const RECIPES = getRecipes();
        const item = this.countertop[this.selectedIndices[0]];

        let ingredients = null;
        for (let [key, val] of Object.entries(RECIPES)) {
            if (val === item && key.includes("+")) {
                ingredients = key.split("+");
                break;
            }
        }

        if (ingredients) {
            this.log(`Chopping: ${item} -> ${ingredients[0]} + ${ingredients[1]}`);
            this.countertop.splice(this.selectedIndices[0], 1);
            this.countertop.push(ingredients[0]);
            this.countertop.push(ingredients[1]);
        } else {
            this.log(`Cannot split ${item}. It is atomic or generic.`, "error");
        }
        this.clearSelection();
        this.render();
    }

    useAmp() {
        if (!this.isDayActive) return;
        if (this.selectedIndices.length !== 1) {
            this.log("AMPLIFIER requires 1 item.", "error");
            return;
        }

        const RECIPES = getRecipes();
        const item = this.countertop[this.selectedIndices[0]];
        const itemCost = this.getIngredientCost(item);

        if (RECIPES[item] && !item.includes("+")) {
            const result = RECIPES[item];
            this.countertop[this.selectedIndices[0]] = result;
            this.log(`Amplified ${item} ($${itemCost}) into ${result} ($${itemCost})!`);

            // Check if item is from Morning Prep (if so, don't unlock recipe)
            const usesMorningPrepItem = this.morningPrepItems.has(item);
            if (!usesMorningPrepItem) {
                this.unlockIngredient(result, itemCost);
            } else {
                this.log("(Cannot unlock recipe - uses temporary Morning Prep ingredient)", "system");
            }
        } else {
            this.log("Nothing happened. Item cannot be amplified.", "error");
        }

        this.clearSelection();
        this.render();
    }

    useMicrowave() {
        if (!this.isDayActive) return;
        if (this.selectedIndices.length !== 1) {
            this.log("MICROWAVE requires 1 item.", "error");
            return;
        }

        const RECIPES = getRecipes();
        const item = this.countertop[this.selectedIndices[0]];
        const itemCost = this.getIngredientCost(item);
        const chance = Math.random();

        // Check if item is from Morning Prep (if so, don't unlock recipe)
        const usesMorningPrepItem = this.morningPrepItems.has(item);

        this.countertop.splice(this.selectedIndices[0], 1);

        let result;
        if (RECIPES[item] && (item === "Meat" || item === "Fish" || item === "Egg" || item === "Potato" || item === "Cheese")) {
            result = RECIPES[item];
            this.log(`Microwave mutated ${item} ($${itemCost}) into ${result} ($${itemCost})!`);
            this.countertop.push(result);
            if (!usesMorningPrepItem) {
                this.unlockIngredient(result, itemCost);
            } else {
                this.log("(Cannot unlock recipe - uses temporary Morning Prep ingredient)", "system");
            }
        } else if (chance > 0.7) {
            result = "Radioactive Slime";
            this.log(`Microwave mutated ${item} ($${itemCost}) into: RADIOACTIVE SLIME ($${itemCost})`, "error");
            this.countertop.push(result);
            if (!usesMorningPrepItem) {
                this.unlockIngredient(result, itemCost);
            } else {
                this.log("(Cannot unlock recipe - uses temporary Morning Prep ingredient)", "system");
            }
        } else {
            result = "Hot " + item;
            this.log(`Microwave made ${item} ($${itemCost}) really hot -> ${result} ($${itemCost})`);
            this.countertop.push(result);
            if (!usesMorningPrepItem) {
                this.unlockIngredient(result, itemCost);
            } else {
                this.log("(Cannot unlock recipe - uses temporary Morning Prep ingredient)", "system");
            }
        }
        this.clearSelection();
        this.render();
    }

    useTrash() {
        if (!this.isDayActive) return;
        if (this.selectedIndices.length === 0) return;

        let totalRefund = 0;

        this.selectedIndices.sort((a, b) => b - a);
        this.selectedIndices.forEach(idx => {
            const item = this.countertop[idx];
            this.log(`Trashed ${item}`);

            // The Recycler: Refund percentage of item cost
            if (this.hasArtifact('the_recycler')) {
                const artifact = getArtifactById('the_recycler');
                const refundRate = artifact.effect.value; // e.g., 0.5 for 50%
                const itemCost = this.getIngredientCost(item);
                const refund = Math.ceil(itemCost * refundRate);
                totalRefund += refund;
            }

            this.countertop.splice(idx, 1);
        });

        if (totalRefund > 0) {
            this.money += totalRefund;
            this.log(`THE RECYCLER: Refunded $${totalRefund}!`, "system");
        }

        this.clearSelection();
        this.render();
    }

    tasteTest() {
        if (!this.isDayActive) return;
        if (this.selectedIndices.length !== 1) {
            this.log("Select 1 item to taste.", "error");
            return;
        }
        const item = this.countertop[this.selectedIndices[0]];

        // Base taste cost
        let sanityCost = 10;

        // Adrenaline Rush: Cap taste cost when below threshold
        if (this.hasArtifact('adrenaline_rush')) {
            const artifact = getArtifactById('adrenaline_rush');
            const costCap = artifact.effect.value; // e.g., 10
            // Parse sanity threshold from condition (e.g., "sanity_lt_40" -> 40)
            const sanityThreshold = parseInt(artifact.effect.condition.split('_')[2]) || 40;
            if (this.sanity < sanityThreshold) {
                sanityCost = Math.min(costCap, sanityCost);
            }
        }

        this.sanity -= sanityCost;

        const attrs = getFoodAttributes(item);

        this.log(`═══ TASTING '${item.toUpperCase()}' ═══`, "system");

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

                this.log(`${category}: ${messages.join(" ")}`, logType);
                hasOutput = true;
            }
        }

        if (!hasOutput) {
            this.log("ANALYSIS: Unremarkable. No distinctive traits detected.");
        }

        this.log("═══════════════════════════════════", "system");

        if (attrs.sanity < 0) {
            const sanityDamage = Math.abs(Math.floor(attrs.sanity));
            this.sanity -= sanityDamage;
            this.log(`The taste damages your sanity! (-${sanityDamage} additional)`, "error");
        }

        // Caffeine Addiction: Coffee restores sanity instead of costing it
        if (this.hasArtifact('caffeine_addiction') && item.toLowerCase().includes('coffee')) {
            const artifact = getArtifactById('caffeine_addiction');
            const sanityBonus = artifact.effect.value;
            const maxSanity = this.getMaxSanity();
            this.sanity = Math.min(maxSanity, this.sanity + sanityBonus);
            this.log(`CAFFEINE ADDICTION: Coffee restores ${sanityBonus} sanity!`, "system");
        }

        if (this.sanity <= 0) {
            this.gameOver("SANITY DEPLETED");
            return;
        }

        if (this.sanity <= 30) {
            this.log("Reality distorting... (Sanity Critical!)", "design");
        } else if (this.sanity <= 50) {
            this.log("Vision blurring... (Sanity Low)", "design");
        }

        this.render();
    }

    serveCustomer() {
        if (!this.isDayActive) return;
        if (this.selectedIndices.length !== 1) {
            this.log("Select 1 dish to serve.", "error");
            return;
        }
        const item = this.countertop[this.selectedIndices[0]];

        if (this.customer.isBoss) {
            this.serveGordonG(item);
            return;
        }

        this.log(`═══ SERVING ${item.toUpperCase()} ═══`, "system");

        const foodAttrs = getFoodAttributes(item);
        const demandVector = this.customer.demand;

        const distance = calculateDistance(foodAttrs, demandVector);
        let payment = calculatePayment(distance);
        const satisfaction = getSatisfactionRating(distance);

        const orderHints = getDemandHints(demandVector);
        this.log(`Order: ${orderHints}`);

        this.log(`${this.customer.name} examines the ${item}...`);

        // this.log(`Distance from demand: ${distance.toFixed(2)}`);

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
        this.log(`Comment: "${comment}"`);

        this.log(`Rating: ${satisfaction.emoji} ${satisfaction.rating}`);

        // Apply payment bonus artifacts (multiplicative stacking)
        let paymentMultiplier = 1;
        const bonusReasons = [];

        const isExcellentOrPerfect = satisfaction.rating === "EXCELLENT" || satisfaction.rating === "PERFECT";

        // Tip Jar: Excellent/Perfect pays extra
        if (this.hasArtifact('tip_jar') && isExcellentOrPerfect) {
            const artifact = getArtifactById('tip_jar');
            paymentMultiplier *= artifact.effect.value;
            bonusReasons.push("Tip Jar");
        }

        // Generous Portions: High filling pays extra
        if (this.hasArtifact('generous_portions')) {
            const artifact = getArtifactById('generous_portions');
            // Parse filling threshold from condition (e.g., "filling_gte_4" -> 4)
            const fillingThreshold = parseInt(artifact.effect.condition.split('_')[2]) || 4;
            if (foodAttrs.filling >= fillingThreshold) {
                paymentMultiplier *= artifact.effect.value;
                bonusReasons.push("Generous Portions");
            }
        }

        // Fast Food Service: Simple dishes pay extra
        if (this.hasArtifact('fast_food_service') && isSimpleDish(item)) {
            const artifact = getArtifactById('fast_food_service');
            paymentMultiplier *= artifact.effect.value;
            bonusReasons.push("Fast Food Service");
        }

        // Price Gouger: Always pays extra
        if (this.hasArtifact('price_gouger')) {
            const artifact = getArtifactById('price_gouger');
            paymentMultiplier *= artifact.effect.paymentMultiplier;
            bonusReasons.push("Price Gouger");
        }

        if (paymentMultiplier > 1) {
            payment *= paymentMultiplier;
            this.log(`BONUS (${bonusReasons.join(" + ")}): ${paymentMultiplier}x payment!`, "system");
        }

        if (payment >= 1) {
            this.money += Math.floor(payment);
            this.log(`Received $${Math.floor(payment)}.`, "system");
        } else if (payment > 0) {
            this.log(`Customer left a few cents. ($${payment.toFixed(2)})`);
        } else {
            this.log("Customer refused to pay.", "error");
        }

        // Meditation Master: Excellent/Perfect gives sanity bonus
        if (this.hasArtifact('meditation_master') && isExcellentOrPerfect) {
            const artifact = getArtifactById('meditation_master');
            const sanityBonus = artifact.effect.value;
            const maxSanity = this.getMaxSanity();
            this.sanity = Math.min(maxSanity, this.sanity + sanityBonus);
            this.log(`MEDITATION MASTER: +${sanityBonus} sanity from excellent service!`, "system");
        }

        this.log("═══════════════════════════════════", "system");

        this.countertop.splice(this.selectedIndices[0], 1);
        this.clearSelection();

        this.customersServedCount++;
        this.render();

        if (this.customersServedCount >= this.customersPerDay) {
            this.endDay();
        } else {
            setTimeout(() => {
                this.nextCustomer();
            }, 1500);
        }
    }

    serveGordonG(item) {
        const currentOrder = this.customer.orders[this.customer.currentCourse];

        this.log(`═══ SERVING ${item.toUpperCase()} AS ${currentOrder.name.toUpperCase()} ═══`, "system");

        const foodAttrs = getFoodAttributes(item);
        const demandVector = currentOrder.demand;

        const distance = calculateDistance(foodAttrs, demandVector);
        const satisfaction = getSatisfactionRating(distance);

        const orderHints = getDemandHints(demandVector);
        this.log(`Order: ${orderHints}`);

        this.log(`Gordon G. scrutinizes the ${item} intensely...`);

        if (distance <= currentOrder.maxDistance) {
            const baseBonus = 25;
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
            this.log(`Comment: "${comment}"`, "system");

            this.log(`Rating: ${satisfaction.emoji} ${satisfaction.rating}`);
            this.money += totalBonus;
            this.log(`Received $${totalBonus}.`, "system");

            this.customer.currentCourse++;
            this.customer.coursesServed++;

            this.countertop.splice(this.selectedIndices[0], 1);
            this.clearSelection();
            this.render();

            if (this.customer.coursesServed >= this.customer.coursesRequired) {
                setTimeout(() => {
                    this.defeatGordonG();
                }, 1500);
            } else {
                setTimeout(() => {
                    this.log(`═══════════════════════════════════`, "system");
                    this.log(`Next course: ${this.customer.orders[this.customer.currentCourse].name}`, "system");
                    UI.updateGordonDisplay(this.customer);
                    this.render();
                }, 1500);
            }
        } else {
            this.log(`Comment: "DISGRACEFUL! This is NOTHING like a proper ${currentOrder.name}!"`, "error");
            this.log(`Rating: ${satisfaction.emoji} ${satisfaction.rating}`, "error");
            this.log("Gordon G smashes his clipboard on the table!", "error");
            this.log("CRITICAL FAILURE - BOSS BATTLE LOST!", "error");

            this.countertop.splice(this.selectedIndices[0], 1);
            this.clearSelection();
            this.render();

            setTimeout(() => {
                this.gameOver("GORDON G DEFEATED YOU");
            }, 2000);
        }
    }

    defeatGordonG() {
        this.log("======================", "system");
        this.log("GORDON G: 'Magnificent! A perfect 3-course meal!'", "system");
        this.log("GORDON G: 'Your cooking... it's RAW TALENT!'", "system");
        this.log("======================", "system");
        this.log("BOSS DEFEATED!", "system");

        this.money += 50;
        this.log("Received $50 BOSS BONUS!");

        this.customersServedCount++;
        this.render();

        setTimeout(() => {
            this.showVictory();
        }, 2000);
    }

    showVictory() {
        this.isDayActive = false;
        this.log("=== YOU DEFEATED GORDON G! ===", "system");
        UI.showVictory(this.day, this.money, this.sanity);
    }

    // --- Artifact Selection System ---

    showArtifactSelection() {
        // Check if there are any artifacts left in the pool
        if (this.artifactPool.length === 0) {
            this.log("No more artifacts available.", "system");
            setTimeout(() => this.startNextDay(), 2000);
            return;
        }

        // Randomly select up to 3 artifacts from the pool
        const numToOffer = Math.min(3, this.artifactPool.length);
        const shuffled = [...this.artifactPool].sort(() => Math.random() - 0.5);
        const selectedArtifactIds = shuffled.slice(0, numToOffer);

        this.log("Choose an artifact to enhance your abilities!", "system");

        UI.showArtifactModal(selectedArtifactIds, (artifactId) => this.selectArtifact(artifactId));
    }

    selectArtifact(artifactId) {
        const artifact = getArtifactById(artifactId);
        if (!artifact) return;

        // Add to active artifacts and remove from pool
        this.activeArtifacts.push(artifactId);
        this.artifactPool = this.artifactPool.filter(id => id !== artifactId);

        this.log(`ARTIFACT ACQUIRED: ${artifact.name}!`, "system");
        this.log(`${artifact.description}`, "design");

        // Special handling for Rent Negotiator
        if (artifactId === 'rent_negotiator') {
            this.rentFrozenUntilDay = this.day + 1;
            this.log("Rent increase frozen for the next day!", "system");
        }

        UI.hideArtifactModal();
        this.render();

        // Start next day after a delay
        setTimeout(() => this.startNextDay(), 2000);
    }

    endDay() {
        this.isDayActive = false;
        this.log("=== SHIFT ENDED ===", "system");

        if (this.countertop.length > 0) {
            this.log(`Discarded ${this.countertop.length} items from countertop.`);
            this.countertop = [];
        }

        const maxSanity = this.getMaxSanity();
        const sanityRestore = 50;
        this.sanity = Math.min(maxSanity, this.sanity + sanityRestore);
        this.log(`Sanity restored by ${sanityRestore}%. Current: ${this.sanity}%`, "system");

        // End-of-day artifact effects
        // Night Owl: Restore sanity if money threshold met
        if (this.hasArtifact('night_owl')) {
            const artifact = getArtifactById('night_owl');
            const sanityBonus = artifact.effect.value; // e.g., 10
            // Parse money threshold from condition string (e.g., "money_gte_50" -> 50)
            const moneyThreshold = parseInt(artifact.effect.condition.split('_')[2]) || 50;
            if (this.money >= moneyThreshold) {
                this.sanity = Math.min(maxSanity, this.sanity + sanityBonus);
                this.log(`NIGHT OWL: +${sanityBonus} sanity for having $${moneyThreshold}+!`, "system");
            }
        }

        // Investment Portfolio: Earn interest based on artifact parameters
        if (this.hasArtifact('investment_portfolio')) {
            const artifact = getArtifactById('investment_portfolio');
            const rate = artifact.effect.rate; // e.g., 0.1 for 10%
            const maxInterest = artifact.effect.max; // e.g., 10
            const interest = Math.min(maxInterest, Math.floor(this.money * rate));
            if (interest > 0) {
                this.money += interest;
                this.log(`INVESTMENT PORTFOLIO: Earned $${interest} interest!`, "system");
            }
        }

        this.log(`Deducting Rent: -$${this.rent}`);
        this.money -= this.rent;
        this.render();

        if (this.money < 0) {
            this.gameOver("BANKRUPT");
            return;
        }

        // Show artifact selection if before day 5 and pool has artifacts
        if (this.day < 5 && this.artifactPool.length > 0) {
            setTimeout(() => this.showArtifactSelection(), 2000);
        } else {
            setTimeout(() => this.startNextDay(), 3000);
        }
    }

    startNextDay() {
        this.day++;
        this.customersServedCount = 0;

        // Clear Morning Prep items from previous day
        this.morningPrepItems.clear();

        // Rent Negotiator: Freeze rent increase if artifact is active and within freeze period
        if (this.day <= this.rentFrozenUntilDay) {
            this.log(`RENT NEGOTIATOR: Rent increase frozen this day!`, "system");
        } else {
            this.rent = Math.floor(this.rent * 1.5);
        }

        this.customersPerDay = 3 + Math.floor(this.day / 2);

        this.log(`=== STARTING DAY ${this.day} ===`, "system");
        this.log(`Rent due at end of shift: $${this.rent}. Customer Quota: ${this.customersPerDay}`);

        const applianceNames = { board: 'BOARD', amp: 'AMPLIFIER', micro: 'MICROWAVE' };
        for (const [appliance, unlockDay] of Object.entries(APPLIANCE_UNLOCK_DAYS)) {
            if (unlockDay === this.day && applianceNames[appliance]) {
                this.log(`NEW APPLIANCE UNLOCKED: [${applianceNames[appliance]}]!`, "system");
            }
        }

        // Morning Prep: Add random items from ANY food (even unlocked ones)
        if (this.hasArtifact('morning_prep')) {
            const artifact = getArtifactById('morning_prep');
            const numItems = artifact.effect.value; // e.g., 2
            const capacity = this.getCountertopCapacity();
            const spaceAvailable = capacity - this.countertop.length;
            const itemsToAdd = Math.min(numItems, spaceAvailable);

            if (itemsToAdd > 0) {
                // Get all possible food items (atoms + all recipe results)
                const RECIPES = getRecipes();
                const atoms = getAtoms();
                const recipeResults = [...new Set(Object.values(RECIPES))]; // Unique recipe results
                const allFoods = [...atoms, ...recipeResults];

                for (let i = 0; i < itemsToAdd; i++) {
                    const randomItem = allFoods[Math.floor(Math.random() * allFoods.length)];
                    this.countertop.push(randomItem);
                    this.morningPrepItems.add(randomItem);
                }

                this.log(`MORNING PREP: Added ${itemsToAdd} mysterious ingredient(s) to countertop!`, "system");
            }
        }

        this.isDayActive = true;
        this.render();
        this.nextCustomer();
    }

    gameOver(reason) {
        this.isDayActive = false;
        this.log(`GAME OVER: ${reason}`, "error");
        const totalServed = this.customersServedCount + (this.day - 1) * 3;
        UI.showGameOver(reason, this.day, totalServed);
    }

    // --- UI Helpers ---

    toggleSelection(index) {
        if (this.selectedIndices.includes(index)) {
            this.selectedIndices = this.selectedIndices.filter(i => i !== index);
        } else {
            this.selectedIndices.push(index);
        }
        this.render();
    }

    clearSelection() {
        this.selectedIndices = [];
        this.render();
    }

    render() {
        UI.render({
            money: this.money,
            sanity: this.sanity,
            maxSanity: this.getMaxSanity(),
            day: this.day,
            rent: this.rent,
            customersServedCount: this.customersServedCount,
            customersPerDay: this.customersPerDay,
            countertop: this.countertop,
            selectedIndices: this.selectedIndices,
            activeArtifacts: this.activeArtifacts,
            onToggleSelection: (index) => this.toggleSelection(index)
        });
    }
}
