// modals.js - Modal show/hide functions

import { getArtifactById } from '../data/DataStore.js';

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
            <div class="artifact-category">[${artifact.category}]</div>
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
