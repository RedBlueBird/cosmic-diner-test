import { loadFoodData, loadRecipes, loadFoodAttributes, loadTasteFeedback, loadCustomers, loadArtifacts, loadConsumables } from './utils.js';
import { Game } from './core/Game.js';
import { initApplianceTooltips } from './ui.js';
import './effects/ArtifactHandlers.js';

// Global game instance (needed for HTML onclick handlers)
let game;

// Initialize the game
async function init() {
    console.log('Initializing Cosmic Diner...');

    // Load all data files in parallel
    const [foodLoaded, recipesLoaded, foodAttrLoaded, feedbackLoaded, customersLoaded, artifactsLoaded, consumablesLoaded] = await Promise.all([
        loadFoodData(),
        loadRecipes(),
        loadFoodAttributes(),
        loadTasteFeedback(),
        loadCustomers(),
        loadArtifacts(),
        loadConsumables()
    ]);

    if (!foodLoaded || !recipesLoaded || !foodAttrLoaded || !feedbackLoaded || !customersLoaded || !artifactsLoaded || !consumablesLoaded) {
        console.error('Failed to load required data files');
        document.getElementById('log-panel').innerHTML =
            '<div style="color: #ff3333;">> ERROR: Failed to load game data. Please refresh.</div>';
        return;
    }

    console.log('All data loaded, starting game...');
    game = new Game();
    game.initializeArtifactPool();
    game.recipeBook.loadFromPersistence();

    // Initialize custom tooltips for appliance buttons
    initApplianceTooltips();

    // Expose game methods to window for HTML onclick handlers
    window.game = game;
}

// Restart game without page refresh
function restartGame() {
    console.log('Restarting game...');

    // Clear the log panel
    const logPanel = document.getElementById('log-panel');
    logPanel.innerHTML = '';

    // Remove any game-over or victory screens
    document.querySelectorAll('.game-over').forEach(el => el.remove());

    // Hide any open modals
    document.getElementById('fridge-modal').classList.add('hidden');
    document.getElementById('artifact-modal').classList.add('hidden');

    // Create a fresh game instance
    game = new Game();
    game.initializeArtifactPool();
    game.recipeBook.loadFromPersistence();

    // Update window reference
    window.game = game;

    console.log('Game restarted successfully!');
}

// Show settings modal
function showSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('hidden');
}

// Hide settings modal
function hideSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.add('hidden');
    // Reset to settings view when closing
    showSettingsView();
}

// Show recipe book view
function showRecipeBookView() {
    // Import dynamically to avoid circular dependencies
    import('./ui/modals.js').then(module => {
        module.showRecipeBookView(game.recipeBook);
    });
}

// Show about view
function showAboutView() {
    import('./ui/modals.js').then(module => {
        module.showAboutView();
    });
}

// Show settings view
function showSettingsView() {
    import('./ui/modals.js').then(module => {
        module.showSettingsView();
    });
}

// Expose functions to window
window.restartGame = restartGame;
window.showSettings = showSettings;
window.hideSettings = hideSettings;
window.showRecipeBookView = showRecipeBookView;
window.showAboutView = showAboutView;
window.showSettingsView = showSettingsView;

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
