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

// Initialize tooltips for all buttons
export function initApplianceTooltips() {
    const buttons = [
        // Appliance buttons
        { id: 'btn-fridge', text: 'Withdraw an ingredient from your stock to Countertop', key: 'Q' },
        { id: 'btn-pan', text: 'Combine two ingredients into a new dish', key: 'W' },
        { id: 'btn-board', text: 'Break down a dish into its base ingredients', key: 'E' },
        { id: 'btn-amp', text: 'Amplify an ingredient into a different variant', key: 'R' },
        { id: 'btn-micro', text: 'Mutate an ingredient with unpredictable results', key: 'T' },
        { id: 'btn-trash', text: 'Discard selected items from the countertop', key: 'Y' },
        // Action buttons
        { id: 'btn-taste', text: 'Analyze a dish\'s properties, costs 10 sanity', key: 'Z' },
        { id: 'btn-serve', text: 'Serve the prepared dish to the customer', key: 'X' }
    ];

    buttons.forEach(({ id, text, key }) => {
        const button = document.getElementById(id);
        if (button) {
            createTooltip(button, `${text}\n\n(Left-Click or ${key} to use)`);
        }
    });

    // Deselect All button
    const deselectBtn = document.getElementById('btn-deselect');
    if (deselectBtn) {
        createTooltip(deselectBtn, '(Left-Click or 0 to use)');
    }

    // Feedback button with title and description
    const feedbackBtn = document.getElementById('feedback-btn');
    if (feedbackBtn) {
        createTooltip(feedbackBtn, 'Give Cosmic Diner Game Feedback \n\n(Opens a Google Form)');
    }
}
