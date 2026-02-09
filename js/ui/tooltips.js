// tooltips.js - Tooltip creation and initialization

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

    // Feedback button with title and description
    const feedbackBtn = document.getElementById('feedback-btn');
    if (feedbackBtn) {
        createTooltip(feedbackBtn, 'Give Cosmic Diner Game Feedback \n\n(Opens a Google Form)');
    }
}
