// Game.js - Slim orchestrator that delegates to managers

import { APPLIANCE_UNLOCK_DAYS } from '../config.js';
import { getAtoms } from '../data/DataStore.js';
import * as UI from '../ui.js';

import { ArtifactManager } from '../managers/ArtifactManager.js';
import { ConsumableManager } from '../managers/ConsumableManager.js';
import { ApplianceManager } from '../managers/ApplianceManager.js';
import { CustomerManager } from '../managers/CustomerManager.js';
import { DayManager } from '../managers/DayManager.js';
import { MerchantManager } from '../managers/MerchantManager.js';

export class Game {
    constructor() {
        // Core game state
        this.money = 50;
        this.sanity = 100;
        this.day = 1;
        this.rent = 30;

        this.customersPerDay = 3;
        this.customersServedCount = 0;
        this.isDayActive = true;

        this.countertop = [];
        this.selectedIndices = [];

        // Ingredient deck
        this.availableIngredients = [];
        this.ingredientCosts = {};
        this.initializeIngredientDeck();

        // Artifact system
        this.activeArtifacts = [];
        this.artifactPool = [];
        this.purchaseHistory = {};
        this.rentFrozenUntilDay = 0;
        this.morningPrepItems = new Set();

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

        // Initialize managers with callbacks
        this.initializeManagers();

        // Grant starting consumable
        this.consumables.grantRandomConsumable();

        this.log("DAY 1 INITIALIZED.");
        this.log("RENT DUE END OF SHIFT: $" + this.rent);

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
            onStartNextDay: () => this.days.startNextDay()
        });

        // Consumable Manager
        this.consumables = new ConsumableManager(state, {
            onLog: (msg, type) => this.log(msg, type),
            onRender: () => this.render(),
            onClearSelection: () => this.clearSelection(),
            onRestoreSanity: (amount) => this.artifacts.restoreSanity(amount),
            onEndDay: () => this.days.endDay(),
            onNextCustomer: () => this.customers.nextCustomer(),
            onGrantArtifact: () => this.artifacts.grantArtifactFromConsumable(),
            getCountertopCapacity: () => this.artifacts.getCountertopCapacity()
        });

        // Appliance Manager
        this.appliances = new ApplianceManager(state, {
            onLog: (msg, type) => this.log(msg, type),
            onRender: () => this.render(),
            onClearSelection: () => this.clearSelection(),
            getAtomCostWithArtifacts: (item, baseCost) => this.artifacts.getAtomCostWithArtifacts(item, baseCost),
            applyBulkDiscount: (item, cost) => this.artifacts.applyBulkDiscount(item, cost),
            getCountertopCapacity: () => this.artifacts.getCountertopCapacity(),
            hasArtifact: (id) => this.artifacts.hasArtifact(id),
            unlockIngredient: (item, cost) => this.unlockIngredient(item, cost)
        });

        // Customer Manager
        this.customers = new CustomerManager(state, {
            onLog: (msg, type) => this.log(msg, type),
            onRender: () => this.render(),
            onClearSelection: () => this.clearSelection(),
            onEndDay: () => this.days.endDay(),
            onGameOver: (reason) => this.days.gameOver(reason),
            hasArtifact: (id) => this.artifacts.hasArtifact(id),
            restoreSanity: (amount) => this.artifacts.restoreSanity(amount),
            isMerchantActive: () => this.merchant ? this.merchant.isMerchantActive() : false
        });

        // Day Manager
        this.days = new DayManager(state, {
            onLog: (msg, type) => this.log(msg, type),
            onRender: () => this.render(),
            onGameOver: (reason) => this.gameOver(reason),
            onNextCustomer: () => this.customers.nextCustomer(),
            hasArtifact: (id) => this.artifacts.hasArtifact(id),
            restoreSanity: (amount) => this.artifacts.restoreSanity(amount),
            getCountertopCapacity: () => this.artifacts.getCountertopCapacity(),
            showArtifactSelection: () => this.artifacts.showArtifactSelection(),
            onShowMerchant: () => this.merchant.showMerchant()
        });

        // Merchant Manager
        this.merchant = new MerchantManager(state, {
            onLog: (msg, type) => this.log(msg, type),
            onRender: () => this.render(),
            onNextCustomer: () => this.customers.nextCustomer(),
            grantConsumable: (id, qty) => this.consumables.grantConsumable(id, qty)
        });
    }

    initializeIngredientDeck() {
        const atoms = getAtoms();
        const shuffled = [...atoms].sort(() => Math.random() - 0.5);
        this.availableIngredients = shuffled.slice(0, 6);
        this.availableIngredients.forEach(atom => {
            this.ingredientCosts[atom] = 1;
        });
        const stockList = this.availableIngredients.map(a => `${a} ($1)`).join(", ");
        this.log("FRIDGE STOCKED WITH: " + stockList, "system");
    }

    getIngredientCost(item) {
        return this.ingredientCosts[item] || 1;
    }

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

    isApplianceUnlocked(appliance) {
        return this.day >= APPLIANCE_UNLOCK_DAYS[appliance];
    }

    log(msg, type = "neutral") {
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

    nextCustomer() {
        this.customers.nextCustomer();
    }

    selectConsumable(consumableId) {
        this.consumables.selectConsumable(consumableId);
    }

    useConsumable() {
        this.consumables.useConsumable();
    }

    grantConsumable(consumableId, quantity = 1) {
        this.consumables.grantConsumable(consumableId, quantity);
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
