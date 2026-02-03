// utils.js - Re-exports and utility functions
// This file maintains backward compatibility while delegating to new modules

// Re-export from DataLoader
export {
    loadFoodData,
    loadRecipes,
    loadFoodAttributes,
    loadTasteFeedback,
    loadCustomers,
    loadArtifacts,
    loadConsumables
} from './data/DataLoader.js';

// Re-export from DataStore
export {
    getRecipes,
    getAdditions,
    getAtoms,
    getCustomerTypes,
    getArtifacts,
    getArtifactById,
    getConsumables,
    getConsumableById,
    getRecipeResult,
    createFoodAttr,
    getDefaultAttributes,
    getFoodAttributesData,
    getTasteFeedbackData
} from './data/DataStore.js';

// Re-export from ItemUtils
export {
    createItemObject,
    getItemName,
    getItemModifiers,
    mergeModifiers,
    getFoodAttributes
} from './utils/ItemUtils.js';

// Re-export from FeedbackService
export {
    getTasteFeedback,
    getDemandHints
} from './services/FeedbackService.js';

// Re-export from PaymentService
export {
    calculateDistance,
    calculatePayment,
    getSatisfactionRating
} from './services/PaymentService.js';

// Re-export from RecipeService
export {
    isSimpleDish,
    tryUnlockRecipe
} from './services/RecipeService.js';
