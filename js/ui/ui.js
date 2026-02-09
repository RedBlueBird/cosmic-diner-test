// ui.js - Core UI rendering functions

import { APPLIANCE_UNLOCK_DAYS } from '../config.js';
import { getArtifactById, getConsumableById } from '../data/DataStore.js';
import { getItemName, getItemModifiers } from '../utils/ItemUtils.js';
import { createTooltip } from './tooltips.js';

// Format modifiers object into readable description
function formatModifiers(modifiers) {
    const entries = Object.entries(modifiers);
    if (entries.length === 0) return "No modifiers";

    return entries.map(([key, value]) => {
        const sign = value > 0 ? '+' : '';
        // Special handling for temporary modifier
        if (key === 'temporary') {
            return '• Temporary (cannot unlock recipes)';
        }
        // Format attribute modifiers
        return `• ${key}: ${sign}${value}`;
    }).join('\n');
}

// Log type to CSS class mapping
const LOG_CLASSES = {
    action: 'log-action', customer: 'log-customer', system: 'log-system',
    artifact: 'log-artifact', consumable: 'log-consumable', merchant: 'log-merchant',
    error: 'log-error', narrative: 'log-narrative'
};

// Log a message to the log panel
export function log(msg, type = "action") {
    const panel = document.getElementById('log-panel');
    const div = document.createElement('div');
    div.textContent = "> " + msg;
    const cssClass = LOG_CLASSES[type];
    if (cssClass) div.className = cssClass;
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
    const { money, sanity, day, rent, customersServedCount, customersPerDay, countertop, countertopCapacity, selectedIndices, activeArtifacts, maxSanity, consumableInventory, selectedConsumable } = gameState;

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

    // Update countertop count in heading
    const countertopCountElement = document.getElementById('countertop-count');
    if (countertopCountElement) {
        countertopCountElement.textContent = `(${countertop.length}/${countertopCapacity})`;
        countertopCountElement.style.color = countertop.length >= countertopCapacity ? '#ff3333' : '#ffff00'; // Red when full
    }

    if (countertop.length === 0) {
        list.innerHTML = '<div style="color: #888; text-align: left;">Get food from Fridge</div>';
    } else {
        countertop.forEach((itemObj, index) => {
            const itemName = getItemName(itemObj);
            const modifiers = getItemModifiers(itemObj);

            const div = document.createElement('div');
            div.className = "item-slot" + (selectedIndices.includes(index) ? " selected" : "");

            // Show ✦ if item has modifiers (e.g., spice vial applied)
            const indicator = Object.keys(modifiers).length > 0 ? " ✦" : "";
            div.textContent = `[${index + 1}] ${itemName}${indicator}`;

            div.onclick = () => gameState.onToggleSelection(index);

            // Add tooltip if item has modifiers
            if (Object.keys(modifiers).length > 0) {
                const modifierDescription = formatModifiers(modifiers);
                createTooltip(div, "Modifiers", modifierDescription);
            }

            list.appendChild(div);
        });
    }

    // Update artifacts display
    updateArtifactsDisplay(activeArtifacts || []);

    // Update consumables display
    updateConsumablesDisplay(
        consumableInventory || {},
        gameState
    );

    // Visual effects based on sanity
    if (sanity < 20) {
        document.body.style.filter = "sepia(100%) hue-rotate(300deg) blur(1.3px) saturate(200%)";
    } else if (sanity < 50) {
        document.body.style.filter = "sepia(50%) hue-rotate(300deg) blur(0.8px)";
    } else {
        document.body.style.filter = "none";
    }
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

// Update boss customer display
export function updateBossDisplay(customer) {
    document.getElementById('customer-name').textContent = customer.name + " [BOSS]";
    document.getElementById('customer-avatar').textContent = customer.avatar;

    const currentOrder = customer.orders[customer.currentCourse];
    document.getElementById('customer-quote').textContent = currentOrder.hint;
    document.getElementById('customer-order').textContent = `Course ${customer.currentCourse + 1}/${customer.orders.length}: ???`;
}

// Update merchant display in right panel
export function updateMerchantDisplay(stock, money, onBuyConsumable, onBuyFood) {
    // Update panel title
    document.getElementById('right-panel-title').textContent = 'MORNING MERCHANT';

    // Update avatar and name
    const merchantAvatar = `
    $$$
   (o o)
  --|~|--
   /| |\\`;
    document.getElementById('customer-avatar').textContent = merchantAvatar;
    document.getElementById('customer-name').textContent = 'Wandering Trader';

    // Hide normal customer info, show shop
    document.getElementById('customer-quote').parentElement.classList.add('hidden');
    document.getElementById('customer-order').parentElement.classList.add('hidden');
    document.getElementById('merchant-shop').classList.remove('hidden');

    // Render consumables
    const consumablesDiv = document.getElementById('merchant-consumables');
    consumablesDiv.innerHTML = '';

    stock.consumables.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = `${item.name} ($${item.price})`;

        // Always allow clicking, merchant will handle insufficient funds
        btn.onclick = () => onBuyConsumable(item.id, item.price);

        // Add tooltip
        createTooltip(btn, item.name, `${item.description}\n\n(Left Click to purchase)`);

        consumablesDiv.appendChild(btn);
    });

    if (stock.consumables.length === 0) {
        consumablesDiv.innerHTML = '<div style="color: #555;">SOLD OUT</div>';
    }

    // Render foods
    const foodsDiv = document.getElementById('merchant-foods');
    foodsDiv.innerHTML = '';

    stock.foods.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = `${item.name} ($${item.price})`;

        // Always allow clicking, merchant will handle insufficient funds
        btn.onclick = () => onBuyFood(item.name, item.price, item.usageCost);

        // Add tooltip with usage cost information
        const tooltipText = `One-time recipe purchase,\nthen $${item.usageCost}/use from Fridge\n\n(Left Click to purchase)`;
        createTooltip(btn, item.name, tooltipText);

        foodsDiv.appendChild(btn);
    });

    if (stock.foods.length === 0) {
        foodsDiv.innerHTML = '<div style="color: #555;">SOLD OUT</div>';
    }
}

// Hide merchant display and restore customer view
export function hideMerchantDisplay() {
    document.getElementById('right-panel-title').textContent = 'CURRENT CUSTOMER';
    document.getElementById('customer-quote').parentElement.classList.remove('hidden');
    document.getElementById('customer-order').parentElement.classList.remove('hidden');
    document.getElementById('merchant-shop').classList.add('hidden');
}

// Update consumables display
export function updateConsumablesDisplay(inventory, gameState) {
    const list = document.getElementById('consumables-list');
    if (!list) return;

    list.innerHTML = "";

    const consumableIds = Object.keys(inventory).filter(id => inventory[id] > 0);

    // Calculate TOTAL quantity (not unique types)
    const totalQuantity = consumableIds.reduce((sum, id) => sum + inventory[id], 0);

    // Update consumables count in heading
    const countElement = document.getElementById('consumables-count');
    if (countElement) {
        countElement.textContent = `(${totalQuantity}/5)`;
        countElement.style.color = totalQuantity >= 5 ? '#ff3333' : '#ffff00'; // Red when full
    }

    if (consumableIds.length === 0) {
        list.innerHTML = '<div style="color: #888; text-align: center;">No consumables available</div>';
        return;
    }

    consumableIds.forEach(id => {
        const consumable = getConsumableById(id);
        if (!consumable) return;

        const quantity = inventory[id];

        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = `${consumable.name} (${quantity})`;
        btn.onclick = () => gameState.onUseConsumable(id);

        btn.oncontextmenu = (e) => {
            e.preventDefault();
            window.game.discardConsumable(id);
        };

        // Add tooltip with consumable description and discard hint
        const tooltipText = `${consumable.description}\n\n(Right-click to discard)`;
        createTooltip(btn, tooltipText);

        list.appendChild(btn);
    });
}

// Show feedback display in right panel
export function showFeedbackDisplay(feedback) {
    // Update panel title
    const titleText = feedback.isBoss ? 'BOSS COURSE COMPLETE' : 'SERVICE COMPLETE';
    document.getElementById('right-panel-title').textContent = titleText;

    // Populate feedback elements
    document.getElementById('feedback-avatar').textContent = feedback.customerAvatar;
    document.getElementById('feedback-customer-name').textContent = feedback.customerName;

    // Show course name for boss
    const courseNameEl = document.getElementById('feedback-course-name');
    if (feedback.isBoss && feedback.courseName) {
        courseNameEl.textContent = feedback.courseName;
        courseNameEl.classList.remove('hidden');
    } else {
        courseNameEl.classList.add('hidden');
    }

    document.getElementById('feedback-comment').textContent = feedback.comment;
    document.getElementById('feedback-rating-emoji').textContent = feedback.rating.emoji;

    const ratingText = document.getElementById('feedback-rating-text');
    ratingText.textContent = feedback.rating.rating;
    ratingText.style.color = feedback.rating.color || '#33ff33';

    // Display bonuses if any
    const bonusesDiv = document.getElementById('feedback-bonuses');
    if (feedback.appliedBonuses && feedback.appliedBonuses.length > 0) {
        bonusesDiv.innerHTML = feedback.appliedBonuses.map(bonus =>
            `<p>✦ ${bonus}</p>`
        ).join('');
    } else {
        bonusesDiv.innerHTML = '';
    }

    // Display sanity cost warning (NOT YET APPLIED)
    const sanityCostDiv = document.getElementById('feedback-sanity-cost');
    if (feedback.sanityCost > 0) {
        let message = '';
        if (feedback.rating.rating === "TERRIBLE") {
            message = `⚠ Collecting will damage your sanity! (-${feedback.sanityCost})`;
        } else if (feedback.rating.rating === "POOR") {
            message = `⚠ Collecting will cost sanity. (-${feedback.sanityCost})`;
        }
        sanityCostDiv.innerHTML = `<p>${message}</p>`;
    } else {
        sanityCostDiv.innerHTML = '';
    }

    document.getElementById('feedback-payment').textContent = feedback.payment;

    // Update button text
    const actionBtn = document.getElementById('feedback-action-btn');
    actionBtn.textContent = `[${feedback.buttonText}]`;

    // Toggle views: hide customer, show feedback
    document.getElementById('customer-view').classList.add('hidden');
    document.getElementById('feedback-view').classList.remove('hidden');
}

// Hide feedback display and restore customer view
export function hideFeedbackDisplay() {
    document.getElementById('right-panel-title').textContent = 'CURRENT CUSTOMER';
    document.getElementById('feedback-view').classList.add('hidden');
    document.getElementById('customer-view').classList.remove('hidden');
}
