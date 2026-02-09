// modals.js - Modal show/hide functions

import { getArtifactById } from '../data/DataStore.js';
import { createTooltip } from './tooltips.js';

// Generic hide modal helper
export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Show fridge modal with items
export function showFridgeModal(ingredients, costs, money, onWithdraw) {
    const modal = document.getElementById('fridge-modal');
    const list = document.getElementById('fridge-items');
    const searchInput = document.getElementById('fridge-search');

    list.innerHTML = "";
    searchInput.value = ""; // Reset search on open

    // Create and store all buttons with data attributes
    ingredients.forEach(item => {
        const cost = costs[item] || 1;
        const btn = document.createElement('button');
        btn.className = "btn";
        btn.textContent = `${item} ($${cost})`;
        btn.dataset.itemName = item.toLowerCase(); // Store lowercase for filtering

        // Grey out if player can't afford
        if (money < cost) {
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
        }
        btn.onclick = () => onWithdraw(item);
        list.appendChild(btn);
    });

    // Set up search filtering
    setupFridgeSearch();

    modal.classList.remove('hidden');
}

// Set up search input filtering
function setupFridgeSearch() {
    const searchInput = document.getElementById('fridge-search');
    const list = document.getElementById('fridge-items');

    // Remove any existing listeners to avoid duplicates
    // (Clone and replace method)
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);

    // Add input event listener for real-time filtering
    newSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const buttons = list.querySelectorAll('.btn');

        buttons.forEach(btn => {
            const itemName = btn.dataset.itemName;

            // Case-insensitive substring matching
            if (itemName.includes(searchTerm)) {
                btn.style.display = ''; // Show matching items
            } else {
                btn.style.display = 'none'; // Hide non-matching items
            }
        });
    });
}

// Hide fridge modal
export function hideFridgeModal() {
    // Clear search input
    const searchInput = document.getElementById('fridge-search');
    if (searchInput) {
        searchInput.value = '';
    }

    // Reset all button visibility
    const list = document.getElementById('fridge-items');
    if (list) {
        const buttons = list.querySelectorAll('.btn');
        buttons.forEach(btn => {
            btn.style.display = '';
        });
    }

    hideModal('fridge-modal');
}

// Show artifact selection modal
export function showArtifactModal(artifactIds, onSelect) {
    const modal = document.getElementById('artifact-modal');
    const optionsDiv = document.getElementById('artifact-options');
    optionsDiv.innerHTML = "";

    artifactIds.forEach(artifactId => {
        const artifact = getArtifactById(artifactId);
        if (!artifact) return;

        const card = document.createElement('div');
        card.className = 'artifact-card';
        card.innerHTML = `
            <div class="artifact-name">${artifact.name}</div>
            <div class="artifact-description">${artifact.description}</div>
        `;
        card.onclick = () => onSelect(artifactId);
        optionsDiv.appendChild(card);
    });

    modal.classList.remove('hidden');
}

// Hide artifact modal
export function hideArtifactModal() {
    hideModal('artifact-modal');
}

// Show game over screen
export function showGameOver(reason, day, customersServed) {
    // Clear sanity visual effects so player can read the game over screen
    document.body.style.filter = "none";

    const panel = document.getElementById('log-panel');
    const gameOverDiv = document.createElement('div');
    gameOverDiv.className = "game-over";
    gameOverDiv.innerHTML = `
        <br>
        =============================<br>
        GAME OVER: ${reason}<br>
        DAYS SURVIVED: ${day}<br>
        CUSTOMERS SERVED: ${customersServed}<br>
        =============================<br>
        <button class="btn" onclick="window.restartGame()">RESTART</button>
        <a class="btn" href="https://docs.google.com/forms/d/e/1FAIpQLSdgbIcJ9WAKpupUfn_u9wrx_eZXS_xxQEdLbvE8eQz2rNU9uw/viewform" target="_blank">FEEDBACK FORM</a>
    `;
    panel.appendChild(gameOverDiv);
}

// Show victory screen
export function showVictory(day, money, sanity, bossName = "THE BOSS") {
    const panel = document.getElementById('log-panel');
    const victoryDiv = document.createElement('div');
    victoryDiv.className = "game-over";
    victoryDiv.innerHTML = `
        <br>
        =============================<br>
        VICTORY!<br>
        =============================<br>
        YOU DEFEATED ${bossName.toUpperCase()}!<br>
        THE BOSS HAS BEEN SATISFIED!<br>
        <br>
        FINAL STATS:<br>
        Days Survived: ${day}<br>
        Total Money Earned: $${money}<br>
        Final Sanity: ${sanity}%<br>
        <br>
        =============================<br>
        STAY TUNED FOR THE FULL VERSION<br>
        WITH MORE BOSSES, ALIEN ARCS,<br>
        AND ELDRITCH HORRORS!<br>
        =============================<br>
        <br>
        <button class="btn" onclick="window.game.continueEndlessMode()">CONTINUE TO ENDLESS MODE</button>
        <button class="btn" onclick="window.restartGame()">RESTART GAME</button>
        <a class="btn" href="https://docs.google.com/forms/d/e/1FAIpQLSdgbIcJ9WAKpupUfn_u9wrx_eZXS_xxQEdLbvE8eQz2rNU9uw/viewform" target="_blank">FEEDBACK FORM</a>
    `;
    panel.appendChild(victoryDiv);
}

// Show recipe book view
export function showRecipeBookView(recipeBookManager) {
    // Clean up any existing tooltips first
    cleanupRecipeTooltips();

    document.getElementById('settings-view').classList.add('hidden');
    const recipeView = document.getElementById('recipe-book-view');
    const content = document.getElementById('recipe-book-content');

    const allFoods = recipeBookManager.getAllFoods();

    if (allFoods.length === 0) {
        content.innerHTML = '<div class="no-recipes">No recipes discovered yet!<br>Start cooking to unlock recipes.</div>';
    } else {
        const recipeList = document.createElement('div');
        recipeList.className = 'recipe-list';

        allFoods.forEach(foodName => {
            const methods = recipeBookManager.getDiscoveryMethods(foodName);
            const recipeItem = document.createElement('div');
            recipeItem.className = 'recipe-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'recipe-name';
            nameSpan.textContent = foodName;
            recipeItem.appendChild(nameSpan);

            // Create tooltip and append to body instead of element
            createRecipeTooltip(recipeItem, 'Discovery Methods', methods);
            recipeList.appendChild(recipeItem);
        });

        content.innerHTML = '';
        content.appendChild(recipeList);
    }

    recipeView.classList.remove('hidden');
}

// Custom tooltip for recipe book that appends to body
function createRecipeTooltip(element, title, description) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';

    if (description) {
        tooltip.innerHTML = `
            <span class="tooltip-name">${title}</span>
            <span class="tooltip-description">${description}</span>
        `;
    } else {
        tooltip.innerHTML = `<span class="tooltip-description">${title}</span>`;
    }

    // Append to body instead of element
    document.body.appendChild(tooltip);

    // Position tooltip on hover
    element.addEventListener('mouseenter', (e) => {
        const rect = element.getBoundingClientRect();
        tooltip.style.position = 'fixed';
        tooltip.style.left = `${rect.right + 10}px`;
        tooltip.style.top = `${rect.top + (rect.height / 2)}px`;
        tooltip.style.transform = 'translateY(-50%)';
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
    });

    element.addEventListener('mouseleave', () => {
        tooltip.style.visibility = 'hidden';
        tooltip.style.opacity = '0';
    });

    // Clean up tooltip when modal closes
    element.addEventListener('remove', () => {
        tooltip.remove();
    });

    return tooltip;
}

// Show about view
export function showAboutView() {
    // Clean up any recipe tooltips
    cleanupRecipeTooltips();
    document.getElementById('settings-view').classList.add('hidden');
    document.getElementById('recipe-book-view').classList.add('hidden');
    document.getElementById('about-view').classList.remove('hidden');
}

// Show settings view
export function showSettingsView() {
    // Clean up any recipe tooltips
    cleanupRecipeTooltips();
    document.getElementById('recipe-book-view').classList.add('hidden');
    document.getElementById('about-view').classList.add('hidden');
    document.getElementById('settings-view').classList.remove('hidden');
}

// Clean up recipe tooltips from DOM
function cleanupRecipeTooltips() {
    // Remove all tooltips that were added to body
    const tooltips = document.querySelectorAll('.tooltip');
    tooltips.forEach(tooltip => {
        // Only remove tooltips that are direct children of body (recipe tooltips)
        if (tooltip.parentElement === document.body) {
            tooltip.remove();
        }
    });
}
