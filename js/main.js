import { loadFoodData, loadTasteFeedback, loadCustomers, loadArtifacts } from './utils.js';
import { Game } from './game.js';
import { initApplianceTooltips } from './ui.js';

// Global game instance (needed for HTML onclick handlers)
let game;

// Initialize the game
async function init() {
    console.log('Initializing Cosmic Diner...');

    // Load all data files in parallel
    const [foodLoaded, feedbackLoaded, customersLoaded, artifactsLoaded] = await Promise.all([
        loadFoodData(),
        loadTasteFeedback(),
        loadCustomers(),
        loadArtifacts()
    ]);

    if (!foodLoaded || !feedbackLoaded || !customersLoaded || !artifactsLoaded) {
        console.error('Failed to load required data files');
        document.getElementById('log-panel').innerHTML =
            '<div style="color: #ff3333;">> ERROR: Failed to load game data. Please refresh.</div>';
        return;
    }

    console.log('All data loaded, starting game...');
    game = new Game();
    game.initializeArtifactPool();

    // Initialize custom tooltips for appliance buttons
    initApplianceTooltips();

    // Expose game methods to window for HTML onclick handlers
    window.game = game;
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
