import { APPLIANCE_UNLOCK_DAYS, FEEDBACK_CATEGORIES, GORDON_G_CONFIG } from './config.js';
import {
    getRecipes, getAtoms, getCustomerTypes,
    getFoodAttributes, getTasteFeedback,
    calculateDistance, calculatePayment, getSatisfactionRating, getDemandHints
} from './utils.js';
import * as UI from './ui.js';

export class Game {
    constructor() {
        this.money = 50;
        this.sanity = 100;
        this.day = 1;
        this.rent = 20;

        this.customersPerDay = 3;
        this.customersServedCount = 0;
        this.isDayActive = true;

        this.countertop = [];
        this.selectedIndices = [];

        // Initialize the ingredient deck with 6 random basic ingredients
        this.availableIngredients = [];
        this.ingredientCosts = {};
        this.initializeIngredientDeck();

        this.log("DAY 1 INITIALIZED.");
        this.log("RENT DUE END OF SHIFT: $" + this.rent);

        this.customer = null;
        this.nextCustomer();
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
        UI.showFridgeModal(
            this.availableIngredients,
            this.ingredientCosts,
            this.money,
            (item) => this.withdrawItem(item)
        );
    }

    closeFridge() {
        UI.hideFridgeModal();
    }

    withdrawItem(item) {
        if (this.countertop.length >= 8) {
            this.log("Countertop is full!", "error");
            this.closeFridge();
            return;
        }

        const cost = this.getIngredientCost(item);

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

        const cost1 = this.getIngredientCost(item1);
        const cost2 = this.getIngredientCost(item2);
        const totalCost = cost1 + cost2;

        let result = RECIPES[key];

        if (!result) {
            result = "Burnt Slop";
            this.log(`Failed Combo: ${item1} + ${item2} = ${result}`, "error");
        } else {
            this.log(`Cooking: ${item1} ($${cost1}) + ${item2} ($${cost2}) -> ${result} ($${totalCost})`);
            this.unlockIngredient(result, totalCost);
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
            this.unlockIngredient(result, itemCost);
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

        this.countertop.splice(this.selectedIndices[0], 1);

        let result;
        if (RECIPES[item] && (item === "Meat" || item === "Fish" || item === "Egg" || item === "Potato" || item === "Cheese")) {
            result = RECIPES[item];
            this.log(`Microwave mutated ${item} ($${itemCost}) into ${result} ($${itemCost})!`);
            this.countertop.push(result);
            this.unlockIngredient(result, itemCost);
        } else if (chance > 0.7) {
            result = "Radioactive Slime";
            this.log(`Microwave mutated ${item} ($${itemCost}) into: RADIOACTIVE SLIME ($${itemCost})`, "error");
            this.countertop.push(result);
            this.unlockIngredient(result, itemCost);
        } else {
            result = "Hot " + item;
            this.log(`Microwave made ${item} ($${itemCost}) really hot -> ${result} ($${itemCost})`);
            this.countertop.push(result);
            this.unlockIngredient(result, itemCost);
        }
        this.clearSelection();
        this.render();
    }

    useTrash() {
        if (!this.isDayActive) return;
        if (this.selectedIndices.length === 0) return;
        this.selectedIndices.sort((a, b) => b - a);
        this.selectedIndices.forEach(idx => {
            this.log(`Trashed ${this.countertop[idx]}`);
            this.countertop.splice(idx, 1);
        });
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
        this.sanity -= 10;

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
        const payment = calculatePayment(distance);
        const satisfaction = getSatisfactionRating(distance);

        const orderHints = getDemandHints(demandVector);
        this.log(`Order: ${orderHints}`);

        this.log(`${this.customer.name} examines the ${item}...`);

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

        if (payment >= 1) {
            this.money += Math.floor(payment);
            this.log(`Received $${Math.floor(payment)}.`, "system");
        } else if (payment > 0) {
            this.log(`Customer left a few cents. ($${payment.toFixed(2)})`);
        } else {
            this.log("Customer refused to pay.", "error");
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

    endDay() {
        this.isDayActive = false;
        this.log("=== SHIFT ENDED ===", "system");

        if (this.countertop.length > 0) {
            this.log(`Discarded ${this.countertop.length} items from countertop.`);
            this.countertop = [];
        }

        const sanityRestore = 50;
        this.sanity = Math.min(100, this.sanity + sanityRestore);
        this.log(`Sanity restored by ${sanityRestore}%. Current: ${this.sanity}%`, "system");

        this.log(`Deducting Rent: -$${this.rent}`);
        this.money -= this.rent;
        this.render();

        if (this.money < 0) {
            this.gameOver("BANKRUPT");
            return;
        }

        setTimeout(() => {
            this.startNextDay();
        }, 3000);
    }

    startNextDay() {
        this.day++;
        this.customersServedCount = 0;

        this.rent = Math.floor(this.rent * 1.5);
        this.customersPerDay = 3 + Math.floor(this.day / 2);

        this.log(`=== STARTING DAY ${this.day} ===`, "system");
        this.log(`Rent increased to $${this.rent}. Customer Quota: ${this.customersPerDay}`);

        const applianceNames = { board: 'BOARD', amp: 'AMPLIFIER', micro: 'MICROWAVE' };
        for (const [appliance, unlockDay] of Object.entries(APPLIANCE_UNLOCK_DAYS)) {
            if (unlockDay === this.day && applianceNames[appliance]) {
                this.log(`NEW APPLIANCE UNLOCKED: [${applianceNames[appliance]}]!`, "system");
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
            day: this.day,
            rent: this.rent,
            customersServedCount: this.customersServedCount,
            customersPerDay: this.customersPerDay,
            countertop: this.countertop,
            selectedIndices: this.selectedIndices,
            onToggleSelection: (index) => this.toggleSelection(index)
        });
    }
}
