// Game.js - Slim orchestrator that delegates to managers

import { APPLIANCE_UNLOCK_DAYS, STARTING_MONEY, STARTING_SANITY, STARTING_RENT, STARTING_CUSTOMERS_PER_DAY, STARTING_ATOM_COUNT } from '../config.js';
import { getAtoms } from '../data/DataStore.js';
import { tryUnlockRecipe } from '../services/RecipeService.js';
import * as UI from '../ui.js';

import { ArtifactManager } from '../managers/ArtifactManager.js';
import { ConsumableManager } from '../managers/ConsumableManager.js';
import { ApplianceManager } from '../managers/ApplianceManager.js';
import { CustomerManager } from '../managers/CustomerManager.js';
import { DayManager } from '../managers/DayManager.js';
import { MerchantManager } from '../managers/MerchantManager.js';
import { RecipeBookManager } from '../managers/RecipeBookManager.js';

export class Game {
    constructor() {
        // Core game state
        this.money = STARTING_MONEY;
        this.sanity = STARTING_SANITY;
        this.day = 1;
        this.rent = STARTING_RENT;

        this.customersPerDay = STARTING_CUSTOMERS_PER_DAY;
        this.customersServedCount = 0;
        this.isDayActive = true;
        this.endlessMode = false;

        this.countertop = [];
        this.selectedIndices = [];

        // Recipe Book Manager (initialize before ingredient deck)
        this.recipeBook = new RecipeBookManager();

        // Ingredient deck
        this.availableIngredients = [];
        this.ingredientCosts = {};
        this.merchantUnlockPrices = {}; // Track original merchant purchase prices
        this.initializeIngredientDeck();

        // Artifact system
        this.activeArtifacts = [];
        this.artifactPool = [];
        this.purchaseHistory = {};
        this.rentFrozenUntilDay = 0;

        // Consumables system
        this.consumableInventory = {};
        this.activeEffects = {
            luckyCoins: 0,
            goldenPlate: false,
            freeWithdrawals: 0
        };
        this.selectedConsumable = null;

        // Customer state
        this.customer = null;

        // Customer feedback pending collection
        this.pendingFeedback = {
            active: false,              // Boolean: is feedback waiting to collect?
            isBoss: false,              // Boolean: is this boss feedback?
            dishName: "",              // String: name of dish served
            comment: "",               // String: customer reaction
            rating: {},                // Object: { rating, emoji, color }
            payment: 0,                // Number: calculated payment
            orderHints: "",            // String: original order for context
            appliedBonuses: [],        // Array: bonus descriptions to display
            sanityCost: 0,             // Number: STORED for application on collect
            customerName: "",          // String: customer who was served
            customerAvatar: "",        // String: ASCII art for feedback display
            buttonText: "COLLECT",     // String: button label (COLLECT / NEXT COURSE / VICTORY)
            courseName: ""             // String: for boss courses (e.g., "APPETIZER")
        };

        // Initialize managers with callbacks
        this.initializeManagers();

        // Grant starting consumable (Commented out for testing)
        // this.consumables.grantRandomConsumable(); 

        this.log("=== STARTING DAY 1 ===", "system");
        this.log(`Rent due at end of shift: $${this.rent}`);

        this.customers.nextCustomer();

        // Initialize Chef's Intuition hover
        this.artifacts.initChefIntuitionHover();
    }

    initializeManagers() {
        // Shared state reference
        const state = this;

        // Artifact Manager
        this.artifacts = new ArtifactManager(state, {
            onLog: (msg, type) => this.log(msg, type),
            onRender: () => this.render(),
            onStartNextDay: () => this.days.startNextDay(),
            showArtifactModal: (ids, cb) => UI.showArtifactModal(ids, cb),
            hideArtifactModal: () => UI.hideArtifactModal()
        });

        // Consumable Manager
        this.consumables = new ConsumableManager(state, {
            onLog: (msg, type) => this.log(msg, type),
            onRender: () => this.render(),
            onClearSelection: () => this.clearSelection(),
            onRestoreSanity: (amount) => this.artifacts.restoreSanity(amount),
            onAdvanceCustomer: (delay) => this.customers.advanceCustomer(delay),
            onGrantArtifact: () => this.artifacts.grantArtifactFromConsumable(),
            getCountertopCapacity: () => this.artifacts.getCountertopCapacity(),
            addToCountertop: (item, mods, silent) => this.appliances.addToCountertop(item, mods, silent)
        });

        // Appliance Manager
        this.appliances = new ApplianceManager(state, {
            onLog: (msg, type) => this.log(msg, type),
            onRender: () => this.render(),
            onClearSelection: () => this.clearSelection(),
            getAtomCostWithArtifacts: (item, baseCost) => this.artifacts.getAtomCostWithArtifacts(item, baseCost),
            applyBulkDiscount: (item, cost) => this.artifacts.applyBulkDiscount(item, cost),
            getCountertopCapacity: () => this.artifacts.getCountertopCapacity(),
            unlockIngredient: (item, cost, inputItems = [], displayCost = null) => this.unlockIngredient(item, cost, inputItems, displayCost),
            trackRecipe: (method, result, inputItems) => this.recipeBook.trackRecipe(method, result, inputItems),
            trackAtom: (atom) => this.recipeBook.trackAtom(atom),
            showFridgeModal: (ingredients, costs, money, cb) => UI.showFridgeModal(ingredients, costs, money, cb),
            hideFridgeModal: () => UI.hideFridgeModal()
        });

        // Customer Manager
        this.customers = new CustomerManager(state, {
            onLog: (msg, type) => this.log(msg, type),
            onRender: () => this.render(),
            onClearSelection: () => this.clearSelection(),
            onEndDay: () => this.days.endDay(),
            onGameOver: (reason) => this.days.gameOver(reason),
            restoreSanity: (amount) => this.artifacts.restoreSanity(amount),
            isMerchantActive: () => this.merchant ? this.merchant.isMerchantActive() : false,
            onProcessEndOfDayEffects: () => this.days.processEndOfDayEffects(),
            updateCustomerDisplay: (customer) => UI.updateCustomerDisplay(customer),
            updateBossDisplay: (customer) => UI.updateBossDisplay(customer),
            showVictory: (day, money, sanity, bossName) => UI.showVictory(day, money, sanity, bossName),
            showFeedbackDisplay: (feedback) => UI.showFeedbackDisplay(feedback),
            hideFeedbackDisplay: () => UI.hideFeedbackDisplay()
        });

        // Day Manager
        this.days = new DayManager(state, {
            onLog: (msg, type) => this.log(msg, type),
            onRender: () => this.render(),
            onGameOver: (reason) => this.gameOver(reason),
            onNextCustomer: () => this.customers.nextCustomer(),
            restoreSanity: (amount) => this.artifacts.restoreSanity(amount),
            getCountertopCapacity: () => this.artifacts.getCountertopCapacity(),
            showArtifactSelection: () => this.artifacts.showArtifactSelection(),
            onShowMerchant: () => this.merchant.showMerchant(),
            addToCountertop: (item, mods, silent) => this.appliances.addToCountertop(item, mods, silent),
            showGameOver: (reason, day, totalServed) => UI.showGameOver(reason, day, totalServed)
        });

        // Merchant Manager
        this.merchant = new MerchantManager(state, {
            onLog: (msg, type) => this.log(msg, type),
            onRender: () => this.render(),
            onNextCustomer: () => this.customers.nextCustomer(),
            grantConsumable: (id, qty) => this.consumables.grantConsumable(id, qty),
            trackMerchantPurchase: (foodName) => this.recipeBook.trackMerchantPurchase(foodName),
            updateMerchantDisplay: (stock, money, buyCb, buyFoodCb) => UI.updateMerchantDisplay(stock, money, buyCb, buyFoodCb),
            hideMerchantDisplay: () => UI.hideMerchantDisplay()
        });
    }

    initializeIngredientDeck() {
        const atoms = getAtoms();
        const shuffled = [...atoms].sort(() => Math.random() - 0.5);
        this.availableIngredients = shuffled.slice(0, STARTING_ATOM_COUNT);
        this.availableIngredients.forEach(atom => {
            this.ingredientCosts[atom] = 1;
            // Track starting atoms in recipe book immediately
            this.recipeBook.trackAtom(atom);
        });
        const stockList = this.availableIngredients.map(a => `${a} ($1)`).join(", ");
        this.log("Fridge stocked with: " + stockList, "system");
    }

    getIngredientCost(item) {
        return this.ingredientCosts[item] || 1;
    }

    unlockIngredient(item, cost, inputItems = [], displayCost = null) {
        // If displayCost not provided, calculate it with artifacts
        const costToDisplay = displayCost !== null ? displayCost : this.artifacts.getAtomCostWithArtifacts(item, cost);

        // If item exists and we're potentially updating it, calculate old display cost
        let oldDisplayCost = null;
        if (this.availableIngredients.includes(item)) {
            const oldBaseCost = this.ingredientCosts[item];
            oldDisplayCost = this.artifacts.getAtomCostWithArtifacts(item, oldBaseCost);
        }

        tryUnlockRecipe(
            item,
            cost,
            this.availableIngredients,
            this.ingredientCosts,
            inputItems,
            (msg, type) => this.log(msg, type),
            costToDisplay,
            oldDisplayCost
        );
    }

    isApplianceUnlocked(appliance) {
        return this.day >= APPLIANCE_UNLOCK_DAYS[appliance];
    }

    log(msg, type = "action") {
        UI.log(msg, type);
    }

    // --- Delegated Methods (for backward compatibility) ---

    initializeArtifactPool() {
        this.artifacts.initializeArtifactPool();
    }

    hasArtifact(artifactId) {
        return this.artifacts.hasArtifact(artifactId);
    }

    getMaxSanity() {
        return this.artifacts.getMaxSanity();
    }

    getCountertopCapacity() {
        return this.artifacts.getCountertopCapacity();
    }

    // --- Actions (delegated to managers) ---

    useFridge() {
        this.appliances.useFridge();
    }

    closeFridge() {
        this.appliances.closeFridge();
    }

    usePan() {
        this.appliances.usePan();
    }

    useBoard() {
        this.appliances.useBoard();
    }

    useAmp() {
        this.appliances.useAmp();
    }

    useMicrowave() {
        this.appliances.useMicrowave();
    }

    useTrash() {
        this.appliances.useTrash();
    }

    tasteTest() {
        this.customers.tasteTest();
    }

    serveCustomer() {
        this.customers.serveCustomer();
    }

    collectPayment() {
        this.customers.collectPayment();
    }

    nextCustomer() {
        this.customers.nextCustomer();
    }

    selectConsumable(consumableId) {
        this.consumables.selectConsumable(consumableId);
    }

    useConsumable() {
        this.consumables.useConsumable();
    }

    discardConsumable(consumableId) {
        this.consumables.discardConsumable(consumableId);
    }

    grantConsumable(consumableId, quantity = 1) {
        return this.consumables.grantConsumable(consumableId, quantity);
    }

    getTotalConsumables() {
        return this.consumables.getTotalConsumables();
    }

    showMerchant() {
        this.merchant.showMerchant();
    }

    dismissMerchant() {
        this.merchant.dismissMerchant();
    }

    isMerchantActive() {
        return this.merchant.isMerchantActive();
    }

    endDay() {
        this.days.endDay();
    }

    startNextDay() {
        this.days.startNextDay();
    }

    gameOver(reason) {
        this.days.gameOver(reason);
    }

    continueEndlessMode() {
        this.endlessMode = true;
        this.log("=== ENTERING ENDLESS MODE ===", "system");
        this.log("The boss is satisfied. The diner continues...", "narrative");
        this.log("Endless customers await!", "narrative");

        // Hide victory modal
        const victoryElements = document.querySelectorAll('.game-over');
        victoryElements.forEach(el => el.remove());

        // Show artifact selection before Day 6 (if artifacts available)
        if (this.artifactPool.length > 0) {
            setTimeout(() => this.artifacts.showArtifactSelection(), 2000);
        } else {
            // No artifacts left, start next day immediately
            setTimeout(() => this.days.startNextDay(), 2000);
        }
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
            countertopCapacity: this.getCountertopCapacity(),
            selectedIndices: this.selectedIndices,
            activeArtifacts: this.activeArtifacts,
            consumableInventory: this.consumableInventory,
            selectedConsumable: this.selectedConsumable,
            onToggleSelection: (index) => this.toggleSelection(index),
            onUseConsumable: (id) => {
                this.selectedConsumable = id;
                this.useConsumable();
            }
        });
    }
}
