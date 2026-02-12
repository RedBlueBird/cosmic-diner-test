// ArtifactHandlers.js - All artifact effect handler registrations
// Handlers are registered at module load time (top-level calls).

import { registerHandler } from './EffectHandlerRegistry.js';
import { getArtifactById, getRecipeResult, getAllFoods } from '../data/DataStore.js';
import { getItemName, createItemObject, hasTemporaryModifier } from '../utils/ItemUtils.js';
import { isSimpleDish } from '../services/RecipeService.js';

// --- Helper ---

function getOrdinalSuffix(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}

// =============================================================================
// getMaxSanity — ArtifactManager
// =============================================================================

registerHandler('getMaxSanity', 'stoics_resolve', (_context, currentValue) => {
    const artifact = getArtifactById('stoics_resolve');
    return artifact.effect.value;
});

// =============================================================================
// getCountertopCapacity — ArtifactManager
// =============================================================================

registerHandler('getCountertopCapacity', 'expanded_countertop', (_context, currentValue) => {
    const artifact = getArtifactById('expanded_countertop');
    return artifact.effect.value;
});

// =============================================================================
// modifyAtomCost — ArtifactManager
// =============================================================================

registerHandler('modifyAtomCost', 'price_gouger', (context, currentCost) => {
    const artifact = getArtifactById('price_gouger');
    return currentCost + artifact.effect.costIncrease;
});

// =============================================================================
// applyBulkDiscount — ArtifactManager
// =============================================================================

registerHandler('applyBulkDiscount', 'bulk_buyer', (context, currentCost) => {
    const { item, state, log } = context;
    const artifact = getArtifactById('bulk_buyer');
    const freeEveryNth = artifact.effect.value;

    // Track purchase history
    if (!state.purchaseHistory[item]) {
        state.purchaseHistory[item] = 0;
    }
    state.purchaseHistory[item]++;

    // Every Nth purchase is free
    if (state.purchaseHistory[item] % freeEveryNth === 0) {
        log(`BULK BUYER: ${item} is FREE! (${freeEveryNth}${getOrdinalSuffix(freeEveryNth)} purchase)`, "artifact");
        return 0;
    }

    return currentCost;
});

// =============================================================================
// panHoverHint — ArtifactManager
// =============================================================================

registerHandler('panHoverHint', 'chefs_intuition', (context, _currentValue) => {
    const { item1, item2 } = context;
    const result = getRecipeResult(getItemName(item1), getItemName(item2));
    return result ? 'success' : 'fail';
});

// =============================================================================
// modifyPanIngredientCost — ApplianceManager
// =============================================================================

registerHandler('modifyPanIngredientCost', 'pan_perfectionist', (context, currentCosts) => {
    const artifact = getArtifactById('pan_perfectionist');
    const reduction = artifact.effect.value;
    const cost1 = Math.max(1, Math.ceil(currentCosts.cost1 * reduction));
    const cost2 = Math.max(1, Math.ceil(currentCosts.cost2 * reduction));
    const percent = Math.round((1 - reduction) * 100);
    context.log(`PAN PERFECTIONIST: Ingredient costs reduced by ${percent}%!`, "artifact");
    return { cost1, cost2 };
});

// =============================================================================
// trashRefund — ApplianceManager
// =============================================================================

// TEMPORARILY DISABLED - The Recycler: trash refund effect
// registerHandler('trashRefund', 'the_recycler', (context, currentRefund) => {
//     const artifact = getArtifactById('the_recycler');
//     const refundRate = artifact.effect.value;
//     const itemCost = context.itemCost;
//     return currentRefund + Math.ceil(itemCost * refundRate);
// });

// =============================================================================
// modifyTasteTestCost — CustomerManager
// =============================================================================

registerHandler('modifyTasteTestCost', 'caffeine_addiction', (context, currentCost) => {
    const artifact = getArtifactById('caffeine_addiction');
    const { attrs } = context;
    const hasCaffeine = attrs.caffeine && attrs.caffeine > 0;
    if (hasCaffeine) {
        return 0; // Caffeinated items cost no sanity
    } else {
        return artifact.effect.normalCost || 15; // Non-caffeinated items cost more
    }
});

registerHandler('modifyTasteTestCost', 'adrenaline_rush', (context, currentCost) => {
    const artifact = getArtifactById('adrenaline_rush');
    const costCap = artifact.effect.value;
    const sanityThreshold = parseInt(artifact.effect.condition.split('_')[2]) || 50;
    if (context.sanity < sanityThreshold) {
        return Math.min(costCap, currentCost);
    }
    return currentCost;
});

// =============================================================================
// postTasteTest — CustomerManager
// =============================================================================

registerHandler('postTasteTest', 'caffeine_addiction', (context) => {
    const { attrs, state, restoreSanity, log, clearSelection } = context;
    const hasCaffeine = attrs.caffeine && attrs.caffeine > 0;
    if (!hasCaffeine) return;

    const artifact = getArtifactById('caffeine_addiction');
    const sanityBonus = artifact.effect.value;
    restoreSanity(sanityBonus);
    log(`CAFFEINE ADDICTION: Caffeine restores ${sanityBonus} sanity!`, "artifact");

    // Consume the caffeinated item
    if (artifact.effect.consume) {
        state.countertop.splice(context.selectedIndex, 1);
        clearSelection();
        log(`The caffeinated item is consumed.`, "artifact");
    }
});

// =============================================================================
// modifyPayment — CustomerManager
// =============================================================================

registerHandler('modifyPayment', 'tip_jar', (context, current) => {
    if (!context.isExcellentOrPerfect) return current;
    const artifact = getArtifactById('tip_jar');
    return {
        multiplier: current.multiplier * artifact.effect.value,
        reasons: [...current.reasons, "Tip Jar"]
    };
});

registerHandler('modifyPayment', 'generous_portions', (context, current) => {
    const artifact = getArtifactById('generous_portions');
    const fillingThreshold = parseInt(artifact.effect.condition.split('_')[2]) || 4;
    if (context.foodAttrs.filling >= fillingThreshold) {
        return {
            multiplier: current.multiplier * artifact.effect.value,
            reasons: [...current.reasons, "Generous Portions"]
        };
    }
    return current;
});

registerHandler('modifyPayment', 'fast_food_service', (context, current) => {
    if (!isSimpleDish(context.itemName)) return current;
    const artifact = getArtifactById('fast_food_service');
    return {
        multiplier: current.multiplier * artifact.effect.value,
        reasons: [...current.reasons, "Fast Food Service"]
    };
});

registerHandler('modifyPayment', 'price_gouger', (context, current) => {
    const artifact = getArtifactById('price_gouger');
    return {
        multiplier: current.multiplier * artifact.effect.paymentMultiplier,
        reasons: [...current.reasons, "Price Gouger"]
    };
});

// =============================================================================
// endOfDay — DayManager
// =============================================================================

registerHandler('endOfDay', 'night_owl', (context) => {
    const artifact = getArtifactById('night_owl');
    const sanityBonus = artifact.effect.value;
    context.restoreSanity(sanityBonus);
    context.log(`NIGHT OWL: +${sanityBonus} sanity!`, "artifact");
});

registerHandler('endOfDay', 'investment_portfolio', (context) => {
    const artifact = getArtifactById('investment_portfolio');
    const rate = artifact.effect.rate;
    const maxInterest = artifact.effect.max;
    const interest = Math.min(maxInterest, Math.floor(context.state.money * rate));
    if (interest > 0) {
        context.state.money += interest;
        context.log(`INVESTMENT PORTFOLIO: Earned $${interest} interest!`, "artifact");
    }
});

// =============================================================================
// startOfDay — DayManager
// =============================================================================

registerHandler('startOfDay', 'morning_prep', (context) => {
    const artifact = getArtifactById('morning_prep');
    const numItems = artifact.effect.value;
    const allFoods = getAllFoods();

    let addedCount = 0;
    for (let i = 0; i < numItems; i++) {
        const randomItem = allFoods[Math.floor(Math.random() * allFoods.length)];
        const success = context.addToCountertop(randomItem, { temporary: 1 }, true);
        if (success) {
            addedCount++;
        } else {
            break; // Stop if countertop becomes full
        }
    }

    if (addedCount > 0) {
        context.log(`MORNING PREP: Added ${addedCount} temporary ingredient(s) to countertop!`, "artifact");
    }
});

// =============================================================================
// onArtifactAcquired — ArtifactManager
// =============================================================================

registerHandler('onArtifactAcquired', 'rent_negotiator', (context) => {
    context.state.rentFrozenUntilDay = context.state.day + 1;
    context.log("Rent increase frozen for the next day!", "artifact");
});

// =============================================================================
// endOfDay — waste_not_want_not
// =============================================================================

registerHandler('endOfDay', 'waste_not_want_not', (context) => {
    const { state, log } = context;
    if (state.countertop.length === 0) return;

    let refundTotal = 0;
    let refundCount = 0;
    for (const item of state.countertop) {
        if (hasTemporaryModifier(item)) continue;
        const name = typeof item === 'string' ? item : item.name;
        refundTotal += state.ingredientCosts[name] || 0;
        refundCount++;
    }

    if (refundTotal > 0) {
        state.money += refundTotal;
        log(`WASTE NOT, WANT NOT: Sold ${refundCount} item(s) for $${refundTotal}!`, "artifact");
    }

    state.countertop = [];
});

// =============================================================================
// modifyPayment — lucid_state
// =============================================================================

registerHandler('modifyPayment', 'lucid_state', (context, current) => {
    const artifact = getArtifactById('lucid_state');
    if (context.sanity < artifact.effect.threshold) {
        return {
            multiplier: current.multiplier * artifact.effect.multiplier,
            reasons: [...current.reasons, "Lucid State"]
        };
    }
    return current;
});

// =============================================================================
// preventBankruptcy — cosmic_insurance
// =============================================================================

registerHandler('preventBankruptcy', 'cosmic_insurance', (context, prevented) => {
    if (prevented) return true;
    const { state, log } = context;
    if (state.cosmicInsuranceUsed) return false;
    state.cosmicInsuranceUsed = true;
    log("COSMIC INSURANCE: Bankruptcy prevented! The artifact is spent.", "artifact");
    return true;
});

// =============================================================================
// preventSanityGameOver — sanity_check
// =============================================================================

registerHandler('preventSanityGameOver', 'sanity_check', (context, prevented) => {
    if (prevented) return true;
    const { state, log } = context;
    if (state.sanityCheckUsed) return false;
    const artifact = getArtifactById('sanity_check');
    state.sanityCheckUsed = true;
    state.sanity = artifact.effect.value;
    log(`SANITY CHECK: Breakdown prevented! Sanity restored to ${artifact.effect.value}. The artifact is spent.`, "artifact");
    return true;
});

// =============================================================================
// modifyPayment — michelin_star
// =============================================================================

registerHandler('modifyPayment', 'michelin_star', (context, current) => {
    const artifact = getArtifactById('michelin_star');
    return {
        multiplier: current.multiplier * artifact.effect.multiplier,
        reasons: [...current.reasons, "Michelin Star"]
    };
});

// =============================================================================
// getCustomersPerDay — michelin_star
// =============================================================================

registerHandler('getCustomersPerDay', 'michelin_star', (context, current) => {
    const artifact = getArtifactById('michelin_star');
    return current + artifact.effect.extraCustomers;
});

// =============================================================================
// getMerchantStockCount — extended_bazaar
// =============================================================================

registerHandler('getMerchantStockCount', 'extended_bazaar', (context, current) => {
    const artifact = getArtifactById('extended_bazaar');
    return current + artifact.effect.value;
});

// =============================================================================
// modifyMerchantPrice — merchants_favor
// =============================================================================

registerHandler('modifyMerchantPrice', 'merchants_favor', (context, currentPrice) => {
    const artifact = getArtifactById('merchants_favor');
    return Math.max(1, Math.ceil(currentPrice * (1 - artifact.effect.value)));
});

// =============================================================================
// postServe — comfort_food
// =============================================================================

registerHandler('postServe', 'comfort_food', (context) => {
    const artifact = getArtifactById('comfort_food');
    if (context.foodAttrs.calming >= artifact.effect.calmingThreshold) {
        context.restoreSanity(artifact.effect.value);
        context.log(`COMFORT FOOD: +${artifact.effect.value} sanity from serving a calming dish!`, "artifact");
    }
});
