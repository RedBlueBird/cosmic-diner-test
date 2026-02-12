// ui.js - Re-exports for backward compatibility
// This file maintains backward compatibility while delegating to new modules

// Re-export from ui/ui.js
export {
    log,
    render,
    updateApplianceButtons,
    updateArtifactsDisplay,
    updateCustomerDisplay,
    updateBossDisplay,
    updateMerchantDisplay,
    hideMerchantDisplay,
    updateConsumablesDisplay,
    showFeedbackDisplay,
    hideFeedbackDisplay,
    hideGameOverDisplay,
    showCustomerView,
    renderPaymentItems
} from './ui/ui.js';

// Re-export from ui/tooltips.js
export {
    createTooltip,
    initApplianceTooltips,
    refreshApplianceTooltips
} from './ui/tooltips.js';

// Re-export from ui/modals.js
export {
    showFridgeModal,
    hideFridgeModal,
    showArtifactModal,
    hideArtifactModal,
    showGameOver,
    showVictory,
    hideModal,
    showRecipeBookView,
    showKeybindsView,
    updateKeybindDisplay,
    showSettingsView
} from './ui/modals.js';
