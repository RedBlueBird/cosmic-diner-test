// OverseerManager.js - Time Overseer meta-progression NPC

import { OVERSEER_MONEY_PENALTY, OVERSEER_SANITY_REDUCTION, OVERSEER_BOSS_CONSUMABLE_COUNT } from '../config.js';
import { getConsumables } from '../data/DataStore.js';

export class OverseerManager {
    constructor(gameState, callbacks) {
        this.state = gameState;
        this.callbacks = callbacks;
        this.offerings = null;
        this.selectedIndex = null;
        this.flavorText = '';
    }

    isOverseerActive() {
        return this.offerings !== null;
    }

    /**
     * Generate offerings based on previous run tier
     */
    generateOfferings(runData) {
        const { day, beatBoss } = runData;
        const offerings = [];
        const culledMod = "Culled. You may only collect one offering.";

        if (beatBoss) {
            offerings.push({
                label: "+$30",
                type: "money", value: 30, culled: true, modifiers: [culledMod]
            });
            offerings.push({
                label: "2 Uncommon Consumables",
                type: "consumable_grant", value: { rarity: "uncommon", count: 2 }, culled: true, modifiers: [culledMod]
            });
            offerings.push({
                label: "Artifact (-$20)", description: `Lose $${OVERSEER_MONEY_PENALTY}. Gain a random artifact.`,
                type: "artifact_penalty", value: OVERSEER_MONEY_PENALTY, culled: true, modifiers: [culledMod]
            });
            offerings.push({
                label: "-50 Max Sanity, 5 Consumables", description: `Permanently lose ${OVERSEER_SANITY_REDUCTION} max sanity. Gain ${OVERSEER_BOSS_CONSUMABLE_COUNT} random consumables.`,
                type: "sanity_penalty_consumables", value: OVERSEER_SANITY_REDUCTION, culled: true, modifiers: [culledMod]
            });
        } else if (day >= 5) {
            offerings.push({
                label: "+$25",
                type: "money", value: 25, culled: true, modifiers: [culledMod]
            });
            offerings.push({
                label: "1 Common + 1 Uncommon",
                type: "consumable_grant", value: { mixed: true }, culled: true, modifiers: [culledMod]
            });
            offerings.push({
                label: "Artifact (-$20)", description: `Lose $${OVERSEER_MONEY_PENALTY}. Gain a random artifact.`,
                type: "artifact_penalty", value: OVERSEER_MONEY_PENALTY, culled: true, modifiers: [culledMod]
            });
        } else if (day >= 3) {
            const moneyAmount = day === 3 ? 15 : 20;
            offerings.push({
                label: `+$${moneyAmount}`,
                type: "money", value: moneyAmount, culled: true, modifiers: [culledMod]
            });
            offerings.push({
                label: "2 Common Consumables",
                type: "consumable_grant", value: { rarity: "common", count: 2 }, culled: true, modifiers: [culledMod]
            });
            offerings.push({
                label: "Artifact (-$20)", description: `Lose $${OVERSEER_MONEY_PENALTY}. Gain a random artifact.`,
                type: "artifact_penalty", value: OVERSEER_MONEY_PENALTY, culled: true, modifiers: [culledMod]
            });
        } else if (day >= 2) {
            offerings.push({
                label: "+$10",
                type: "money", value: 10, culled: true, modifiers: [culledMod]
            });
            offerings.push({
                label: "1 Common Consumable",
                type: "consumable_grant", value: { rarity: "common", count: 1 }, culled: true, modifiers: [culledMod]
            });
        } else {
            offerings.push({
                label: "+$5",
                type: "money", value: 5, culled: true, modifiers: [culledMod]
            });
            offerings.push({
                label: "1 Common Consumable",
                type: "consumable_grant", value: { rarity: "common", count: 1 }, culled: true, modifiers: [culledMod]
            });
        }

        return offerings;
    }

    /**
     * Get flavor text based on previous run
     */
    getFlavorText(runData) {
        const { day, beatBoss } = runData;

        if (beatBoss) {
            return "The space around it hums with approval that has no sound. You have earned its attention. That is rare. That is dangerous.";
        } else if (day >= 5) {
            return "It holds out its offering with the gravity of a last chance given freely.";
        } else if (day >= 4) {
            return "Its silhouette leans forward. It presses an offering toward you with force behind it.";
        } else if (day >= 3) {
            return "It extends its offering slowly, as if giving you time to understand what you lost and what you might still become.";
        } else if (day >= 2) {
            return "It regards you with something adjacent to recognition. It reaches into a fold of space that wasn't there a moment ago.";
        }
        return "It tilts its head. A slow, pitying angle. It holds something out.";
    }

    /**
     * Show the overseer in the right panel
     */
    showOverseer(runData) {
        this.offerings = this.generateOfferings(runData);
        this.selectedIndex = null;
        this.flavorText = this.getFlavorText(runData);

        this.callbacks.onLog("The Time Overseer appears.", "narrative");

        this.callbacks.updateOverseerDisplay(this.offerings, this.selectedIndex, this.flavorText, (index) => this.selectOffering(index));
        this.callbacks.onRender();
    }

    /**
     * Re-render the overseer display (e.g. after keybind change)
     */
    refreshDisplay() {
        if (!this.offerings) return;
        this.callbacks.updateOverseerDisplay(this.offerings, this.selectedIndex, this.flavorText, (i) => this.selectOffering(i));
    }

    /**
     * Toggle offering selection (Culled: only one at a time)
     */
    selectOffering(index) {
        if (!this.offerings) return;

        if (this.selectedIndex === index) {
            this.selectedIndex = null;
        } else {
            this.selectedIndex = index;
        }

        this.callbacks.updateOverseerDisplay(this.offerings, this.selectedIndex, this.flavorText, (i) => this.selectOffering(i));
    }

    /**
     * Single action button: collect if selected, skip if not
     */
    overseerAction() {
        if (!this.offerings) return;

        if (this.selectedIndex !== null) {
            const offering = this.offerings[this.selectedIndex];
            this.applyOffering(offering);
        } else {
            this.callbacks.onLog("The Time Overseer departs...", "narrative");
        }

        this.dismissOverseer();
    }

    /**
     * Dismiss the overseer and continue to first customer
     */
    dismissOverseer() {
        this.callbacks.disableOverseerButtons();
        this.offerings = null;
        this.selectedIndex = null;

        this.state.customersServedCount++;
        this.callbacks.onRender();

        setTimeout(() => {
            this.callbacks.onNextCustomer();
        }, 500);
    }

    /**
     * Apply the selected offering's effect
     */
    applyOffering(offering) {
        switch (offering.type) {
            case 'money':
                this.state.money += offering.value;
                this.callbacks.onLog(`Collected offering: +$${offering.value}.`, "narrative");
                break;

            case 'consumable_grant':
                this.callbacks.onLog("Collected offering:", "narrative");
                this.grantConsumables(offering.value);
                break;

            case 'artifact_penalty':
                this.state.money -= offering.value;
                this.callbacks.onLog(`Collected offering: -$${offering.value}, gained a random artifact.`, "narrative");
                this.callbacks.grantArtifact();
                break;

            case 'sanity_penalty_consumables':
                this.state.maxSanityModifier -= offering.value;
                const newMax = this.callbacks.getMaxSanity();
                if (this.state.sanity > newMax) {
                    this.state.sanity = newMax;
                }
                this.callbacks.onLog(`Collected offering: -${offering.value} max sanity.`, "narrative");
                this.grantRandomConsumables(OVERSEER_BOSS_CONSUMABLE_COUNT);
                break;
        }

        this.callbacks.onRender();
    }

    /**
     * Grant consumables based on offering value spec
     */
    grantConsumables(spec) {
        const allConsumables = getConsumables();

        if (spec.mixed) {
            const commons = allConsumables.filter(c => c.rarity === 'common');
            const uncommons = allConsumables.filter(c => c.rarity === 'uncommon');
            if (commons.length > 0) {
                const pick = commons[Math.floor(Math.random() * commons.length)];
                this.callbacks.grantConsumable(pick.id, 1);
                this.callbacks.onLog(`Received ${pick.name}.`, "consumable");
            }
            if (uncommons.length > 0) {
                const pick = uncommons[Math.floor(Math.random() * uncommons.length)];
                this.callbacks.grantConsumable(pick.id, 1);
                this.callbacks.onLog(`Received ${pick.name}.`, "consumable");
            }
        } else {
            const eligible = allConsumables.filter(c => c.rarity === spec.rarity);
            for (let i = 0; i < spec.count; i++) {
                if (eligible.length > 0) {
                    const pick = eligible[Math.floor(Math.random() * eligible.length)];
                    this.callbacks.grantConsumable(pick.id, 1);
                    this.callbacks.onLog(`Received ${pick.name}.`, "consumable");
                }
            }
        }
    }

    /**
     * Grant N consumables of random rarity
     */
    grantRandomConsumables(count) {
        const allConsumables = getConsumables();
        for (let i = 0; i < count; i++) {
            if (allConsumables.length > 0) {
                const pick = allConsumables[Math.floor(Math.random() * allConsumables.length)];
                this.callbacks.grantConsumable(pick.id, 1);
                this.callbacks.onLog(`Received ${pick.name}.`, "consumable");
            }
        }
    }
}
