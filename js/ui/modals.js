// modals.js - Modal show/hide functions

import { getArtifactById } from '../data/DataStore.js';
import { KEYBINDING_LABELS } from '../config.js';
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
    document.getElementById('fridge-backdrop').classList.remove('hidden');

    // Auto-focus search input for keyboard use
    const input = document.getElementById('fridge-search');
    if (input) setTimeout(() => input.focus(), 50);
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
    hideModal('fridge-backdrop');
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

// Show game over screen in right panel
export function showGameOver(reason, day, customersServed) {
    // Clear sanity visual effects so player can read the game over screen
    document.body.style.filter = "none";

    document.getElementById('right-panel-title').textContent = 'GAME OVER';

    document.getElementById('gameover-content').innerHTML = `
        =============================
        <div class="stat-row"><span>REASON:</span><span>${reason}</span></div>
        <div class="stat-row"><span>DAYS SURVIVED:</span><span>${day}</span></div>
        <div class="stat-row"><span>CUSTOMERS SERVED:</span><span>${customersServed}</span></div>
        =============================
    `;

    document.getElementById('gameover-buttons').innerHTML = `
        <button class="btn" onclick="window.restartGame()">RESTART</button>
        <a class="btn" href="https://docs.google.com/forms/d/e/1FAIpQLSdgbIcJ9WAKpupUfn_u9wrx_eZXS_xxQEdLbvE8eQz2rNU9uw/viewform" target="_blank">FEEDBACK FORM</a>
    `;

    document.getElementById('customer-view').classList.add('hidden');
    document.getElementById('feedback-view').classList.add('hidden');
    document.getElementById('merchant-shop').classList.add('hidden');
    document.getElementById('overseer-shop').classList.add('hidden');
    document.getElementById('gameover-view').classList.remove('hidden');
}

// Show victory screen in right panel
export function showVictory(day, money, sanity, customersServed, bossName = "THE BOSS") {
    document.getElementById('right-panel-title').textContent = 'VICTORY';

    document.getElementById('gameover-content').innerHTML = `
        =============================<br>
        YOU DEFEATED ${bossName.toUpperCase()}!
        <br><br>
        <div class="stat-row"><span>DAYS SURVIVED:</span><span>${day}</span></div>
        <div class="stat-row"><span>CUSTOMERS SERVED:</span><span>${customersServed}</span></div>
        =============================<br>
        STAY TUNED FOR THE FULL VERSION WITH MORE BOSSES, ALIEN ARCS, AND ELDRITCH HORRORS!<br>
        =============================
    `;

    document.getElementById('gameover-buttons').innerHTML = `
        <button class="btn" onclick="window.game.continueEndlessMode()">CONTINUE TO ENDLESS MODE</button>
        <button class="btn" onclick="window.restartGame()">RESTART GAME</button>
        <a class="btn" href="https://docs.google.com/forms/d/e/1FAIpQLSdgbIcJ9WAKpupUfn_u9wrx_eZXS_xxQEdLbvE8eQz2rNU9uw/viewform" target="_blank">FEEDBACK FORM</a>
    `;

    document.getElementById('customer-view').classList.add('hidden');
    document.getElementById('feedback-view').classList.add('hidden');
    document.getElementById('merchant-shop').classList.add('hidden');
    document.getElementById('overseer-shop').classList.add('hidden');
    document.getElementById('gameover-view').classList.remove('hidden');
}

// Show recipe book view
export function showRecipeBookView(recipeBookManager) {
    // Clean up any existing tooltips first
    cleanupRecipeTooltips();

    document.getElementById('settings-view').classList.add('hidden');
    document.getElementById('keybinds-view').classList.add('hidden');
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

// Show keybinds view
export function showKeybindsView(keybindManager) {
    // Clean up any existing tooltips first
    cleanupRecipeTooltips();

    document.getElementById('settings-view').classList.add('hidden');
    document.getElementById('recipe-book-view').classList.add('hidden');
    document.getElementById('about-view').classList.add('hidden');

    const keybindsView = document.getElementById('keybinds-view');
    const content = document.getElementById('keybinds-content');
    const bindings = keybindManager.getBindings();

    const keybindsList = document.createElement('div');
    keybindsList.className = 'keybinds-list';

    for (const [action, key] of Object.entries(bindings)) {
        const label = KEYBINDING_LABELS[action] || action;

        const item = document.createElement('div');
        item.className = 'keybind-item';
        item.dataset.action = action;

        const labelSpan = document.createElement('span');
        labelSpan.className = 'keybind-label';
        labelSpan.textContent = label;

        const keySpan = document.createElement('span');
        keySpan.className = 'keybind-key';
        keySpan.textContent = formatKeyDisplay(key);

        item.appendChild(labelSpan);
        item.appendChild(keySpan);

        // Tooltip: "Press any key to rebind"
        createKeybindTooltip(item, 'Press any key to rebind');

        // Hover sets/clears rebind target
        item.addEventListener('mouseenter', () => keybindManager.setRebindTarget(action));
        item.addEventListener('mouseleave', () => keybindManager.clearRebindTarget());

        keybindsList.appendChild(item);
    }

    content.innerHTML = '';
    content.appendChild(keybindsList);

    keybindsView.classList.remove('hidden');
}

// Format key for display
function formatKeyDisplay(key) {
    if (key === 'Escape') return 'ESC';
    if (key === ' ') return 'SPACE';
    if (key === 'ArrowUp') return 'UP';
    if (key === 'ArrowDown') return 'DOWN';
    if (key === 'ArrowLeft') return 'LEFT';
    if (key === 'ArrowRight') return 'RIGHT';
    return key.toUpperCase();
}

// Tooltip for keybind items (appended to body, same cleanup as recipe tooltips)
function createKeybindTooltip(element, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.innerHTML = `<span class="tooltip-description">${text}</span>`;

    document.body.appendChild(tooltip);

    element.addEventListener('mouseenter', () => {
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

    return tooltip;
}

// Update a single keybind item's key display
export function updateKeybindDisplay(action, key) {
    const item = document.querySelector(`.keybind-item[data-action="${action}"]`);
    if (item) {
        const keySpan = item.querySelector('.keybind-key');
        if (keySpan) keySpan.textContent = formatKeyDisplay(key);
    }
}

// Show about view
export function showAboutView() {
    // Clean up any recipe tooltips
    cleanupRecipeTooltips();
    document.getElementById('settings-view').classList.add('hidden');
    document.getElementById('recipe-book-view').classList.add('hidden');
    document.getElementById('keybinds-view').classList.add('hidden');
    document.getElementById('about-view').classList.remove('hidden');
}

// Show settings view
export function showSettingsView() {
    // Clean up any recipe tooltips
    cleanupRecipeTooltips();
    document.getElementById('recipe-book-view').classList.add('hidden');
    document.getElementById('about-view').classList.add('hidden');
    document.getElementById('keybinds-view').classList.add('hidden');
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
