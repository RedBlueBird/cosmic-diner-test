// ArtifactManager.js - Artifact system management

import { getArtifacts, getArtifactById, getRecipeResult } from '../data/DataStore.js';
import { getItemName } from '../utils/ItemUtils.js';
import * as UI from '../ui.js';

export class ArtifactManager {
    constructor(gameState, callbacks) {
        this.state = gameState;
        this.callbacks = callbacks;
    }

    initializeArtifactPool() {
        const artifacts = getArtifacts();
        this.state.artifactPool = artifacts.map(a => a.id);
    }

    hasArtifact(artifactId) {
        return this.state.activeArtifacts.includes(artifactId);
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
        const freeEveryNth = artifact.effect.value;

        // Track purchase history
        if (!this.state.purchaseHistory[item]) {
            this.state.purchaseHistory[item] = 0;
        }
        this.state.purchaseHistory[item]++;

        // Every Nth purchase is free
        if (this.state.purchaseHistory[item] % freeEveryNth === 0) {
            this.callbacks.onLog(`BULK BUYER: ${item} is FREE! (${freeEveryNth}${this.getOrdinalSuffix(freeEveryNth)} purchase)`, "system");
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

        panButton.style.position = 'relative';

        panButton.addEventListener('mouseenter', () => {
            if (!this.hasArtifact('chefs_intuition')) return;
            if (this.state.selectedIndices.length !== 2) return;

            const item1 = this.state.countertop[this.state.selectedIndices[0]];
            const item2 = this.state.countertop[this.state.selectedIndices[1]];
            const result = getRecipeResult(getItemName(item1), getItemName(item2));

            const tooltip = document.createElement('div');
            tooltip.className = 'appliance-tooltip';
            tooltip.id = 'chef-intuition-tooltip';

            if (result) {
                tooltip.classList.add('success');
                tooltip.textContent = 'This might work...';
            } else {
                tooltip.classList.add('fail');
                tooltip.textContent = 'This will fail...';
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

    // Show artifact selection at end of day
    showArtifactSelection() {
        if (this.state.artifactPool.length === 0) {
            this.callbacks.onLog("No more artifacts available.", "system");
            setTimeout(() => this.callbacks.onStartNextDay(), 2000);
            return;
        }

        const numToOffer = Math.min(3, this.state.artifactPool.length);
        const shuffled = [...this.state.artifactPool].sort(() => Math.random() - 0.5);
        const selectedArtifactIds = shuffled.slice(0, numToOffer);

        this.callbacks.onLog("Choose an artifact to enhance your abilities!", "system");

        UI.showArtifactModal(selectedArtifactIds, (artifactId) => this.selectArtifact(artifactId));
    }

    selectArtifact(artifactId) {
        const artifact = getArtifactById(artifactId);
        if (!artifact) return;

        this.state.activeArtifacts.push(artifactId);
        this.state.artifactPool = this.state.artifactPool.filter(id => id !== artifactId);

        this.callbacks.onLog(`ARTIFACT ACQUIRED: ${artifact.name}!`, "system");
        this.callbacks.onLog(`${artifact.description}`, "design");

        // Special handling for Rent Negotiator
        if (artifactId === 'rent_negotiator') {
            this.state.rentFrozenUntilDay = this.state.day + 1;
            this.callbacks.onLog("Rent increase frozen for the next day!", "system");
        }

        UI.hideArtifactModal();
        this.callbacks.onRender();

        setTimeout(() => this.callbacks.onStartNextDay(), 2000);
    }

    // Grant artifact from consumable (Wishing Well Penny)
    grantArtifactFromConsumable() {
        if (this.state.artifactPool.length === 0) {
            this.callbacks.onLog("No more artifacts available!", "system");
            this.state.money += 50;
            this.callbacks.onLog("Received $50 refund instead.", "system");
            return;
        }

        const randomIndex = Math.floor(Math.random() * this.state.artifactPool.length);
        const artifactId = this.state.artifactPool[randomIndex];
        const artifact = getArtifactById(artifactId);

        this.state.activeArtifacts.push(artifactId);
        this.state.artifactPool = this.state.artifactPool.filter(id => id !== artifactId);

        this.callbacks.onLog("=== WISHING WELL PENNY ===", "system");
        this.callbacks.onLog(`ARTIFACT ACQUIRED: ${artifact.name}!`, "system");
        this.callbacks.onLog(`${artifact.description}`, "design");
        this.callbacks.onLog("===========================", "system");

        if (artifactId === 'rent_negotiator') {
            this.state.rentFrozenUntilDay = this.state.day + 1;
            this.callbacks.onLog("Rent increase frozen for the next day!", "system");
        }

        this.callbacks.onRender();
    }

    // Restore sanity with cap
    restoreSanity(amount) {
        const maxSanity = this.getMaxSanity();
        this.state.sanity = Math.min(maxSanity, this.state.sanity + amount);
    }
}
