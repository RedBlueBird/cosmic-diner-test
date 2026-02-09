// ArtifactManager.js - Artifact system management

import { DEFAULT_MAX_SANITY, DEFAULT_COUNTERTOP_CAPACITY } from '../config.js';
import { getArtifacts, getArtifactById } from '../data/DataStore.js';
import { runHook, runEffectHook } from '../effects/EffectHandlerRegistry.js';

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
        return runHook('getMaxSanity', this.state.activeArtifacts, { defaultValue: DEFAULT_MAX_SANITY });
    }

    getCountertopCapacity() {
        return runHook('getCountertopCapacity', this.state.activeArtifacts, { defaultValue: DEFAULT_COUNTERTOP_CAPACITY });
    }

    getAtomCostWithArtifacts(item, baseCost) {
        return runHook('modifyAtomCost', this.state.activeArtifacts, {
            defaultValue: baseCost,
            item
        });
    }

    applyBulkDiscount(item, cost) {
        return runHook('applyBulkDiscount', this.state.activeArtifacts, {
            defaultValue: cost,
            item,
            state: this.state,
            log: (msg, type) => this.callbacks.onLog(msg, type)
        });
    }

    // Initialize Chef's Intuition hover behavior on PAN button
    initChefIntuitionHover() {
        const panButton = document.getElementById('btn-pan');
        if (!panButton) return;

        panButton.style.position = 'relative';

        panButton.addEventListener('mouseenter', () => {
            if (this.state.selectedIndices.length !== 2) return;

            const item1 = this.state.countertop[this.state.selectedIndices[0]];
            const item2 = this.state.countertop[this.state.selectedIndices[1]];

            const hintResult = runHook('panHoverHint', this.state.activeArtifacts, {
                defaultValue: null,
                item1,
                item2
            });

            if (hintResult === null) return;

            const tooltip = document.createElement('div');
            tooltip.className = 'appliance-tooltip';
            tooltip.id = 'chef-intuition-tooltip';

            if (hintResult === 'success') {
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

        this.callbacks.showArtifactModal(selectedArtifactIds, (artifactId) => this.selectArtifact(artifactId));
    }

    selectArtifact(artifactId) {
        this.activateArtifact(artifactId);

        this.callbacks.hideArtifactModal();
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

        this.callbacks.onLog("=== WISHING WELL PENNY ===", "consumable");
        this.activateArtifact(artifactId);

        this.callbacks.onRender();
    }

    // Shared artifact activation logic
    activateArtifact(artifactId) {
        const artifact = getArtifactById(artifactId);
        if (!artifact) return;

        this.state.activeArtifacts.push(artifactId);
        this.state.artifactPool = this.state.artifactPool.filter(id => id !== artifactId);

        this.callbacks.onLog(`ARTIFACT ACQUIRED: ${artifact.name}!`, "artifact");
        this.callbacks.onLog(`${artifact.description}`, "artifact");

        // Run onArtifactAcquired hooks for the newly acquired artifact only
        runEffectHook('onArtifactAcquired', [artifactId], {
            state: this.state,
            log: (msg, type) => this.callbacks.onLog(msg, type)
        });
    }

    // Restore sanity with cap
    restoreSanity(amount) {
        const maxSanity = this.getMaxSanity();
        this.state.sanity = Math.min(maxSanity, this.state.sanity + amount);
    }
}
