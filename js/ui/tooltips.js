// tooltips.js - Tooltip creation and initialization

// Reusable tooltip component
// Supports two modes:
//   Single:  createTooltip(element, title, description)
//   Multi:   createTooltip(element, [{title, description}, ...])
export function createTooltip(element, titleOrList, description) {
    // Multi-tooltip mode: first arg after element is an array
    if (Array.isArray(titleOrList)) {
        return createMultiTooltip(element, titleOrList);
    }

    // Single tooltip mode (existing behavior)
    const title = titleOrList;
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

// Create multiple stacked tooltip boxes for one element
function createMultiTooltip(element, tooltipConfigs) {
    const container = document.createElement('div');
    container.className = 'tooltip-container';

    tooltipConfigs.forEach(config => {
        const box = document.createElement('div');
        box.className = 'tooltip-box';
        if (config.description) {
            box.innerHTML = `
                <span class="tooltip-name">${config.title}</span>
                <span class="tooltip-description">${config.description}</span>
            `;
        } else {
            box.innerHTML = `<span class="tooltip-description">${config.title}</span>`;
        }
        container.appendChild(box);
    });

    element.appendChild(container);
    element.style.position = 'relative';

    element.addEventListener('mouseenter', () => {
        const rect = element.getBoundingClientRect();
        container.style.left = `${rect.right + 10}px`;
        container.style.top = `${rect.top + (rect.height / 2)}px`;
        container.style.transform = 'translateY(-50%)';
        container.style.visibility = 'visible';
        container.style.opacity = '1';
    });

    element.addEventListener('mouseleave', () => {
        container.style.visibility = 'hidden';
        container.style.opacity = '0';
    });

    return container;
}

// Appliance/action button tooltip definitions (text + action name for key lookup)
const APPLIANCE_TOOLTIPS = [
    { id: 'btn-fridge', name: 'Fridge', text: 'Withdraw an ingredient from your stock to countertop', action: 'fridge' },
    { id: 'btn-pan', name: 'Pan', text: 'Combine two ingredients into a new dish', action: 'pan' },
    { id: 'btn-board', name: 'Board', text: 'Break down a dish into its base ingredients', action: 'board' },
    { id: 'btn-amp', name: 'Amplifier', text: 'Amplify an ingredient into a different variant', action: 'amp' },
    { id: 'btn-micro', name: 'Microwave', text: 'Mutate an ingredient with unpredictable results', action: 'microwave' },
    { id: 'btn-trash', name: 'Trash', text: 'Discard selected items from the countertop', action: 'trash' },
    { id: 'btn-taste', name: 'Taste Test', text: 'Analyze a dish\'s properties, costs 10 sanity', action: 'tasteTest' },
    { id: 'btn-serve', name: 'Serve', text: 'Serve the prepared dish to the customer', action: 'serve' }
];

// Default key fallbacks (used on initial load before keybindManager exists)
const DEFAULT_KEYS = {
    fridge: 'Q', pan: 'W', board: 'E', amp: 'R', microwave: 'T', trash: 'Y',
    tasteTest: 'Z', serve: 'X', deselectAll: '0'
};

// Remove existing tooltip children from an element
export function clearTooltips(element) {
    const tooltips = element.querySelectorAll('.tooltip, .tooltip-container');
    tooltips.forEach(t => t.remove());
}

// Initialize tooltips for all buttons
export function initApplianceTooltips(keybindManager) {
    const getKey = (action) => keybindManager ? keybindManager.getKeyForAction(action) : DEFAULT_KEYS[action];

    APPLIANCE_TOOLTIPS.forEach(({ id, name, text, action }) => {
        const button = document.getElementById(id);
        if (button) {
            const key = getKey(action);
            const keyHint = `(Left-Click or ${key} to use)`;
            createTooltip(button, [
                { title: name, description: text },
                { title: keyHint }
            ]);
        }
    });

    // Deselect All button
    const deselectBtn = document.getElementById('btn-deselect');
    if (deselectBtn) {
        const key = getKey('deselectAll');
        const keyHint = `(Left-Click or ${key} to use)`;
        createTooltip(deselectBtn, [
            { title: keyHint }
        ]);
    }

    // Feedback button with title and description
    const feedbackBtn = document.getElementById('feedback-btn');
    if (feedbackBtn) {
        createTooltip(feedbackBtn, [
            { title: 'Feedback', description: 'Give Cosmic Diner Game Feedback' },
            { title: '(Opens a Google Form)' }
        ]);
    }
}

// Refresh appliance tooltips with current keybindings (called after rebind)
export function refreshApplianceTooltips(keybindManager) {
    APPLIANCE_TOOLTIPS.forEach(({ id, name, text, action }) => {
        const button = document.getElementById(id);
        if (button) {
            clearTooltips(button);
            const key = keybindManager.getKeyForAction(action);
            const keyHint = `(Left-Click or ${key} to use)`;
            createTooltip(button, [
                { title: name, description: text },
                { title: keyHint }
            ]);
        }
    });

    const deselectBtn = document.getElementById('btn-deselect');
    if (deselectBtn) {
        clearTooltips(deselectBtn);
        const key = keybindManager.getKeyForAction('deselectAll');
        const keyHint = `(Left-Click or ${key} to use)`;
        createTooltip(deselectBtn, [
            { title: 'Deselect All', description: 'Clear all selected countertop items' },
            { title: keyHint }
        ]);
    }
}
