// ui.js - Core UI rendering functions

import { APPLIANCE_UNLOCK_DAYS } from '../config.js';
import { getArtifactById, getConsumableById } from '../data/DataStore.js';
import { getItemName, getItemModifiers } from '../utils/ItemUtils.js';
import { createTooltip, clearTooltips } from './tooltips.js';

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
export function updateMerchantDisplay(stock, money, onBuyConsumable, onBuyFood, merchantSlotKeys = null, confirmKey = null) {
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

    // Hide normal customer info and feedback view, show shop
    document.getElementById('customer-quote').parentElement.classList.add('hidden');
    document.getElementById('customer-order').parentElement.classList.add('hidden');
    document.getElementById('feedback-view').classList.add('hidden');
    document.getElementById('customer-view').classList.remove('hidden');
    document.getElementById('merchant-shop').classList.remove('hidden');
    document.getElementById('payment-items-list').innerHTML = '';

    // Re-enable leave button (may have been disabled by disableLeaveButton)
    const leaveBtn = document.getElementById('btn-leave-shop');
    if (leaveBtn) {
        leaveBtn.disabled = false;
        leaveBtn.textContent = '[LEAVE SHOP]';
        // Clear old tooltips and add keybind hint
        clearTooltips(leaveBtn);
        const leaveHint = confirmKey ? `(Left-Click or ${confirmKey} to use)` : '(Left-Click to use)';
        createTooltip(leaveBtn, [
            { title: 'Leave Shop', description: 'Dismiss the merchant and continue your day' },
            { title: leaveHint }
        ]);
    }

    // Render consumables
    const consumablesDiv = document.getElementById('merchant-consumables');
    consumablesDiv.innerHTML = '';

    stock.consumables.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = `${item.name} ($${item.price})`;

        // Always allow clicking, merchant will handle insufficient funds
        btn.onclick = () => onBuyConsumable(item.id, item.price);

        // Add tooltip with keybind hint
        const slotKey = merchantSlotKeys ? merchantSlotKeys[index] : null;
        const keyHint = slotKey ? `(Left-Click or Shift+${slotKey} to purchase)` : '(Left-Click to purchase)';
        createTooltip(btn, [
            { title: item.name, description: item.description },
            { title: keyHint }
        ]);

        consumablesDiv.appendChild(btn);
    });

    if (stock.consumables.length === 0) {
        consumablesDiv.innerHTML = '<div style="color: #555;">SOLD OUT</div>';
    }

    // Render foods
    const foodsDiv = document.getElementById('merchant-foods');
    foodsDiv.innerHTML = '';

    const consumableCount = stock.consumables.length;
    stock.foods.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = `${item.name} ($${item.price})`;

        // Always allow clicking, merchant will handle insufficient funds
        btn.onclick = () => onBuyFood(item.name, item.price, item.usageCost);

        // Add tooltip with usage cost and keybind hint
        const slotKey = merchantSlotKeys ? merchantSlotKeys[consumableCount + index] : null;
        const keyHint = slotKey ? `(Left-Click or Shift+${slotKey} to purchase)` : '(Left-Click to purchase)';
        createTooltip(btn, [
            { title: item.name, description: `One-time recipe purchase,\nthen $${item.usageCost}/use from Fridge` },
            { title: keyHint }
        ]);

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

    const slotKeys = gameState.consumableSlotKeys || ['A', 'S', 'D', 'F', 'G'];

    consumableIds.forEach((id, index) => {
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

        // Add stacked tooltips: keybind hints + consumable info
        const key = slotKeys[index] || null;
        const useHint = key ? `(Left-Click or ${key} to use)` : '(Left-Click to use)';
        const discardHint = key ? `(Right-Click or Shift+${key} to discard)` : '(Right-Click to discard)';
        createTooltip(btn, [
            { title: consumable.name, description: consumable.description },
            { title: `${useHint}\n${discardHint}` }
        ]);

        list.appendChild(btn);
    });
}

// Show feedback display in right panel
export function showFeedbackDisplay(feedback, onTogglePaymentSelection, paymentSlotKeys = null, confirmKey = null) {
    // Update panel title
    let titleText = 'SERVICE COMPLETE';
    if (feedback.isBossBonus) {
        titleText = 'BOSS DEFEATED';
    } else if (feedback.isBoss) {
        titleText = 'BOSS COURSE COMPLETE';
    }
    document.getElementById('right-panel-title').textContent = titleText;

    // Populate feedback elements
    document.getElementById('feedback-avatar').textContent = feedback.customerAvatar;
    document.getElementById('feedback-customer-name').textContent = feedback.customerName;

    // Hide course name (no longer displayed)
    document.getElementById('feedback-course-name').classList.add('hidden');

    document.getElementById('feedback-comment').textContent = feedback.comment;
    document.getElementById('feedback-rating-emoji').textContent = feedback.rating.emoji;

    // Payment section
    const paymentSection = document.getElementById('payment-section');
    const bossPaymentLine = document.getElementById('boss-payment-line');
    const paymentItems = feedback.paymentItems || [];

    // Re-enable action button (may have been disabled by disableFeedbackAction)
    const actionBtn = document.getElementById('feedback-action-btn');
    actionBtn.disabled = false;

    if (paymentItems.length > 0) {
        // Show interactive payment items
        paymentSection.classList.remove('hidden');
        bossPaymentLine.classList.add('hidden');
        renderPaymentItems(paymentItems, [], onTogglePaymentSelection, (feedback.isBoss && !feedback.isBossBonus) ? feedback.buttonText : null, paymentSlotKeys, confirmKey);
    } else {
        // No payment items (e.g. boss course with $0 payment somehow)
        paymentSection.classList.add('hidden');
        bossPaymentLine.classList.add('hidden');

        clearTooltips(actionBtn);
        actionBtn.textContent = `[${feedback.buttonText}]`;
        const keyHint = confirmKey ? `(Left-Click or ${confirmKey} to use)` : '(Left-Click to use)';
        createTooltip(actionBtn, keyHint);
    }

    // Toggle views: hide customer, show feedback
    document.getElementById('customer-view').classList.add('hidden');
    document.getElementById('feedback-view').classList.remove('hidden');
}

// Render interactive payment items in feedback view
// bossButtonText: if provided, use this fixed text for the button (boss flow)
export function renderPaymentItems(paymentItems, selectedIndices, onToggle, bossButtonText = null, paymentSlotKeys = null, confirmKey = null) {
    const list = document.getElementById('payment-items-list');
    list.innerHTML = '';

    paymentItems.forEach((item, index) => {
        const div = document.createElement('div');
        let className = 'item-slot';
        if (selectedIndices.includes(index)) className += ' selected';
        if (item.binded) className += ' binded';
        div.className = className;

        const indicator = (item.modifiers.length > 0 || item.consumableInfo) ? ' ✦' : '';
        div.textContent = `[${index + 1}] ${item.label}${indicator}`;

        div.onclick = () => onToggle(index);

        // Build keybind select hint
        const slotKey = paymentSlotKeys ? paymentSlotKeys[index] : (index + 1).toString();
        const selectHint = `(Left-Click or Shift+${slotKey} to select)`;

        // Tooltip
        if (item.consumableInfo) {
            // 3 stacked tooltips for consumable items
            createTooltip(div, [
                { title: item.consumableInfo.tipText },
                { title: item.consumableInfo.name, description: item.consumableInfo.description },
                { title: selectHint }
            ]);
        } else if (item.modifiers.length > 0) {
            // 2 stacked tooltips for modifier items
            createTooltip(div, [
                { title: 'Modifiers', description: item.modifiers.map(m => `- ${m}`).join('\n') },
                { title: selectHint }
            ]);
        } else {
            createTooltip(div, selectHint);
        }

        list.appendChild(div);
    });

    // Update button text and tooltip
    const actionBtn = document.getElementById('feedback-action-btn');
    clearTooltips(actionBtn);
    const keyHint = confirmKey ? `(Left-Click or ${confirmKey} to use)` : '(Left-Click to use)';
    if (bossButtonText) {
        actionBtn.textContent = `[${bossButtonText}]`;
    } else {
        const hasBinded = paymentItems.some(item => item.binded);
        const hasSelection = selectedIndices.length > 0;
        actionBtn.textContent = (!hasSelection && !hasBinded) ? '[SKIP PAYMENT]' : '[COLLECT]';
    }
    createTooltip(actionBtn, keyHint);
}

// Hide feedback display and restore customer view
export function hideFeedbackDisplay() {
    document.getElementById('right-panel-title').textContent = 'CURRENT CUSTOMER';
    document.getElementById('feedback-view').classList.add('hidden');
    document.getElementById('customer-view').classList.remove('hidden');
    document.getElementById('payment-items-list').innerHTML = '';
}

// Hide game over/victory display and restore customer view
export function hideGameOverDisplay() {
    document.getElementById('right-panel-title').textContent = 'CURRENT CUSTOMER';
    document.getElementById('gameover-view').classList.add('hidden');
    document.getElementById('customer-view').classList.remove('hidden');
}

// Transition right panel to customer view from any state (feedback, merchant, gameover)
export function showCustomerView() {
    document.getElementById('right-panel-title').textContent = 'CURRENT CUSTOMER';
    document.getElementById('feedback-view').classList.add('hidden');
    document.getElementById('merchant-shop').classList.add('hidden');
    document.getElementById('gameover-view').classList.add('hidden');
    document.getElementById('customer-quote').parentElement.classList.remove('hidden');
    document.getElementById('customer-order').parentElement.classList.remove('hidden');
    document.getElementById('customer-view').classList.remove('hidden');
    document.getElementById('payment-items-list').innerHTML = '';
}
