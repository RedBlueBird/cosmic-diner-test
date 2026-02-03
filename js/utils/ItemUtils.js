// ItemUtils.js - Item object helper functions

import { getFoodAttributesData, createFoodAttr } from '../data/DataStore.js';

// Create standardized item object
export function createItemObject(name, modifiers = {}) {
    return { name, modifiers: { ...modifiers } };
}

// Extract name (backward compatible with strings)
export function getItemName(item) {
    return typeof item === 'string' ? item : item.name;
}

// Extract modifiers
export function getItemModifiers(item) {
    return typeof item === 'string' ? {} : (item.modifiers || {});
}

// Merge parent modifiers for recipe inheritance
export function mergeModifiers(mods1, mods2) {
    const merged = { ...mods1 };
    for (const [attr, value] of Object.entries(mods2)) {
        merged[attr] = (merged[attr] || 0) + value;
    }
    return merged;
}

// Get attributes for any food item (with fallback for unknown items)
export function getFoodAttributes(item) {
    const itemName = getItemName(item);
    const itemModifiers = getItemModifiers(item);
    const FOOD_ATTRIBUTES = getFoodAttributesData();

    // Get base attributes (existing logic)
    let baseAttrs;
    if (FOOD_ATTRIBUTES[itemName]) {
        baseAttrs = { ...FOOD_ATTRIBUTES[itemName] };
    } else if (itemName.startsWith("Hot ")) {
        // Fallback for dynamically created items (like "Hot X")
        const baseItem = itemName.substring(4);
        if (FOOD_ATTRIBUTES[baseItem]) {
            baseAttrs = { ...FOOD_ATTRIBUTES[baseItem], temperature: 8 };
        } else {
            baseAttrs = createFoodAttr({ sanity: -1, health: 2, filling: 3 });
        }
    } else {
        // Ultimate fallback - mysterious unknown food
        baseAttrs = createFoodAttr({ sanity: -1, health: 2, filling: 3 });
    }

    // Apply runtime modifiers
    for (const [attr, modifier] of Object.entries(itemModifiers)) {
        baseAttrs[attr] = (baseAttrs[attr] || 0) + modifier;
    }

    return baseAttrs;
}

// Check if item has temporary modifier
export function hasTemporaryModifier(item) {
    const itemObj = typeof item === 'string' ? { name: item, modifiers: {} } : item;
    return itemObj.modifiers?.temporary > 0;
}
