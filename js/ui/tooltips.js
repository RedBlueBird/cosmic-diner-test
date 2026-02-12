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
    { id: 'btn-fridge', text: 'Withdraw an ingredient from your stock to Countertop', action: 'fridge' },
    { id: 'btn-pan', text: 'Combine two ingredients into a new dish', action: 'pan' },
    { id: 'btn-board', text: 'Break down a dish into its base ingredients', action: 'board' },
    { id: 'btn-amp', text: 'Amplify an ingredient into a different variant', action: 'amp' },
    { id: 'btn-micro', text: 'Mutate an ingredient with unpredictable results', action: 'microwave' },
    { id: 'btn-trash', text: 'Discard selected items from the countertop', action: 'trash' },
    { id: 'btn-taste', text: 'Analyze a dish\'s properties, costs 10 sanity', action: 'tasteTest' },
    { id: 'btn-serve', text: 'Serve the prepared dish to the customer', action: 'serve' }
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

    APPLIANCE_TOOLTIPS.forEach(({ id, text, action }) => {
        const button = document.getElementById(id);
        if (button) {
            const key = getKey(action);
            createTooltip(button, `${text}\n\n(Left-Click or ${key} to use)`);
        }
    });

    // Deselect All button
    const deselectBtn = document.getElementById('btn-deselect');
    if (deselectBtn) {
        const key = getKey('deselectAll');
        createTooltip(deselectBtn, `(Left-Click or ${key} to use)`);
    }

    // Feedback button with title and description
    const feedbackBtn = document.getElementById('feedback-btn');
    if (feedbackBtn) {
        createTooltip(feedbackBtn, 'Give Cosmic Diner Game Feedback \n\n(Opens a Google Form)');
    }
}

// Refresh appliance tooltips with current keybindings (called after rebind)
export function refreshApplianceTooltips(keybindManager) {
    APPLIANCE_TOOLTIPS.forEach(({ id, text, action }) => {
        const button = document.getElementById(id);
        if (button) {
            clearTooltips(button);
            const key = keybindManager.getKeyForAction(action);
            createTooltip(button, `${text}\n\n(Left-Click or ${key} to use)`);
        }
    });

    const deselectBtn = document.getElementById('btn-deselect');
    if (deselectBtn) {
        clearTooltips(deselectBtn);
        const key = keybindManager.getKeyForAction('deselectAll');
        createTooltip(deselectBtn, `(Left-Click or ${key} to use)`);
    }
}
