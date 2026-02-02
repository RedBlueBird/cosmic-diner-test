import { APPLIANCE_UNLOCK_DAYS } from './config.js';
import { getArtifactById } from './utils.js';

// Reusable tooltip component
export function createTooltip(element, title, description) {
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

    element.appendChild(tooltip);
    element.style.position = 'relative';

    // Position tooltip on hover using fixed positioning
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

    return tooltip;
}

// Log a message to the log panel
export function log(msg, type = "neutral") {
    const panel = document.getElementById('log-panel');
    const div = document.createElement('div');
    div.textContent = "> " + msg;
    if (type === "error") div.style.color = "#ff3333";
    if (type === "design") div.className = "design-alert";
    if (type === "system") div.style.color = "#ffff00";
    panel.appendChild(div);
    panel.scrollTop = panel.scrollHeight;
}

// Update appliance button visibility based on current day
export function updateApplianceButtons(day) {
    const appliances = ['fridge', 'pan', 'board', 'amp', 'micro', 'trash'];
    appliances.forEach(appliance => {
        const btn = document.getElementById(`btn-${appliance}`);
        if (btn) {
            if (day >= APPLIANCE_UNLOCK_DAYS[appliance]) {
                btn.style.display = '';
            } else {
                btn.style.display = 'none';
            }
        }
    });
}

// Render the main game UI
export function render(gameState) {
    const { money, sanity, day, rent, customersServedCount, customersPerDay, countertop, selectedIndices, activeArtifacts, maxSanity } = gameState;

    document.getElementById('money').textContent = money;

    const sanityDisplay = document.getElementById('sanity');
    sanityDisplay.textContent = `${sanity} / ${maxSanity}`;
    if (sanity <= 30) {
        sanityDisplay.className = "sanity-critical";
    } else {
        sanityDisplay.className = "";
    }

    document.getElementById('day-display').textContent = day;
    document.getElementById('rent-display').textContent = rent;

    // Update appliance visibility based on day
    updateApplianceButtons(day);

    const percentage = (customersServedCount / customersPerDay) * 100;
    document.getElementById('progress-bar').style.width = percentage + "%";
    document.getElementById('progress-text').textContent =
        `SHIFT PROGRESS: ${customersServedCount} / ${customersPerDay}`;

    const list = document.getElementById('countertop-list');
    list.innerHTML = "";
    countertop.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = "item-slot" + (selectedIndices.includes(index) ? " selected" : "");
        div.textContent = `[${index + 1}] ${item}`;
        div.onclick = () => gameState.onToggleSelection(index);
        list.appendChild(div);
    });

    // Update artifacts display
    updateArtifactsDisplay(activeArtifacts || []);

    // Visual effects based on sanity
    if (sanity < 20) {
        document.body.style.filter = "sepia(100%) hue-rotate(300deg) blur(2px) saturate(200%)";
    } else if (sanity < 50) {
        document.body.style.filter = "sepia(50%) hue-rotate(300deg) blur(1px)";
    } else {
        document.body.style.filter = "none";
    }
}

// Initialize tooltips for all buttons
export function initApplianceTooltips() {
    const buttons = [
        // Appliance buttons
        { id: 'btn-fridge', text: 'Withdraw an ingredient from your stock to Countertop' },
        { id: 'btn-pan', text: 'Combine two ingredients into a new dish' },
        { id: 'btn-board', text: 'Break down a dish into its base ingredients' },
        { id: 'btn-amp', text: 'Amplify an ingredient into a different variant' },
        { id: 'btn-micro', text: 'Mutate an ingredient with unpredictable results' },
        { id: 'btn-trash', text: 'Discard selected items from the countertop' },
        // Action buttons
        { id: 'btn-taste', text: 'Analyze a dish\'s properties (costs 10 sanity)' },
        { id: 'btn-serve', text: 'Serve the prepared dish to the customer' }
    ];

    buttons.forEach(({ id, text }) => {
        const button = document.getElementById(id);
        if (button) {
            createTooltip(button, text);
        }
    });
}

// Update artifacts display
export function updateArtifactsDisplay(activeArtifactIds) {
    const section = document.getElementById('artifacts-section');
    const list = document.getElementById('artifacts-list');

    // Show section only if there are artifacts
    if (activeArtifactIds.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    list.innerHTML = "";

    activeArtifactIds.forEach((artifactId, index) => {
        const artifact = getArtifactById(artifactId);
        if (!artifact) return;

        const div = document.createElement('div');
        div.className = 'artifact-item';
        div.textContent = `[${index + 1}] ${artifact.name}`;

        // Add tooltip using the reusable component
        createTooltip(div, artifact.name, artifact.description);

        list.appendChild(div);
    });
}

// Update customer display
export function updateCustomerDisplay(customer) {
    document.getElementById('customer-name').textContent = customer.name;
    document.getElementById('customer-quote').textContent = customer.hint;
    document.getElementById('customer-avatar').textContent = customer.avatar;
    document.getElementById('customer-order').textContent = customer.orderHints || "???";
}

// Update Gordon G boss display
export function updateGordonDisplay(customer) {
    document.getElementById('customer-name').textContent = customer.name + " [BOSS]";
    document.getElementById('customer-avatar').textContent = customer.avatar;

    const currentOrder = customer.orders[customer.currentCourse];
    document.getElementById('customer-quote').textContent = currentOrder.hint;
    document.getElementById('customer-order').textContent = `Course ${customer.currentCourse + 1}/3: ???`;
}

// Show fridge modal with items
export function showFridgeModal(ingredients, costs, money, onWithdraw) {
    const modal = document.getElementById('fridge-modal');
    const list = document.getElementById('fridge-items');
    list.innerHTML = "";

    ingredients.forEach(item => {
        const cost = costs[item] || 1;
        const btn = document.createElement('button');
        btn.className = "btn";
        btn.textContent = `${item} ($${cost})`;
        // Grey out if player can't afford
        if (money < cost) {
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
        }
        btn.onclick = () => onWithdraw(item);
        list.appendChild(btn);
    });

    modal.classList.remove('hidden');
}

// Hide fridge modal
export function hideFridgeModal() {
    document.getElementById('fridge-modal').classList.add('hidden');
}

// Show artifact selection modal
export function showArtifactModal(artifactIds, onSelect) {
    const modal = document.getElementById('artifact-modal');
    const optionsDiv = document.getElementById('artifact-options');
    optionsDiv.innerHTML = "";

    // Import getArtifactById dynamically (we need it for display)
    import('./utils.js').then(({ getArtifactById }) => {
        artifactIds.forEach(artifactId => {
            const artifact = getArtifactById(artifactId);
            if (!artifact) return;

            const card = document.createElement('div');
            card.className = 'artifact-card';
            card.innerHTML = `
                <div class="artifact-name">${artifact.name}</div>
                <div class="artifact-description">${artifact.description}</div>
                <div class="artifact-category">[${artifact.category}]</div>
            `;
            card.onclick = () => onSelect(artifactId);
            optionsDiv.appendChild(card);
        });
    });

    modal.classList.remove('hidden');
}

// Hide artifact modal
export function hideArtifactModal() {
    document.getElementById('artifact-modal').classList.add('hidden');
}

// Show game over screen
export function showGameOver(reason, day, customersServed) {
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
        <button class="btn" onclick="location.reload()">RESTART</button>
    `;
    panel.appendChild(gameOverDiv);
}

// Show victory screen
export function showVictory(day, money, sanity) {
    const panel = document.getElementById('log-panel');
    const victoryDiv = document.createElement('div');
    victoryDiv.className = "game-over";
    victoryDiv.innerHTML = `
        <br>
        =============================<br>
        VICTORY!<br>
        =============================<br>
        YOU DEFEATED GORDON G!<br>
        THE FOOD CRITIC HAS BEEN SATISFIED!<br>
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
        <button class="btn" onclick="location.reload()">RESTART GAME</button>
    `;
    panel.appendChild(victoryDiv);
}
