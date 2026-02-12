// KeybindManager.js - Keyboard shortcut handling

export class KeybindManager {
    constructor(gameState, callbacks) {
        this.state = gameState;
        this.callbacks = callbacks;

        // Fridge navigation state
        this.fridgeHighlightIndex = -1;

        // Artifact modal state
        this.artifactIds = null;
        this.artifactSelectCallback = null;

        // Bind handler so we can remove it later
        this._onKeyDown = (e) => this.handleKeyDown(e);
        document.addEventListener('keydown', this._onKeyDown);
    }

    destroy() {
        document.removeEventListener('keydown', this._onKeyDown);
    }

    // --- Artifact modal context ---

    setArtifactModalContext(ids, callback) {
        this.artifactIds = ids;
        this.artifactSelectCallback = callback;
    }

    clearArtifactModalContext() {
        this.artifactIds = null;
        this.artifactSelectCallback = null;
    }

    // --- Context detection ---

    getContext() {
        const gameover = document.getElementById('gameover-view');
        if (gameover && !gameover.classList.contains('hidden')) return 'gameover';

        const settings = document.getElementById('settings-modal');
        if (settings && !settings.classList.contains('hidden')) {
            const recipeBook = document.getElementById('recipe-book-view');
            if (recipeBook && !recipeBook.classList.contains('hidden')) return 'settings-sub';
            const about = document.getElementById('about-view');
            if (about && !about.classList.contains('hidden')) return 'settings-sub';
            return 'settings';
        }

        const artifact = document.getElementById('artifact-modal');
        if (artifact && !artifact.classList.contains('hidden')) return 'artifact';

        const fridge = document.getElementById('fridge-modal');
        if (fridge && !fridge.classList.contains('hidden')) return 'fridge';

        return 'gameplay';
    }

    // --- Fridge helpers ---

    getVisibleFridgeItems() {
        const list = document.getElementById('fridge-items');
        if (!list) return [];
        return Array.from(list.querySelectorAll('.btn')).filter(btn => btn.style.display !== 'none');
    }

    updateFridgeHighlight() {
        const items = this.getVisibleFridgeItems();
        // Remove existing highlight
        items.forEach(btn => btn.classList.remove('fridge-highlight'));
        // Apply new highlight
        if (this.fridgeHighlightIndex >= 0 && this.fridgeHighlightIndex < items.length) {
            items[this.fridgeHighlightIndex].classList.add('fridge-highlight');
            items[this.fridgeHighlightIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    resetFridgeHighlight() {
        this.fridgeHighlightIndex = -1;
    }

    // --- Consumable slot helper ---

    getConsumableIdBySlot(slotIndex) {
        const inventory = this.state.consumableInventory;
        const ids = Object.keys(inventory).filter(id => inventory[id] > 0);
        return ids[slotIndex] || null;
    }

    // --- Main handler ---

    handleKeyDown(e) {
        // Don't intercept browser shortcuts
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        const context = this.getContext();

        // Game over: ignore all keys
        if (context === 'gameover') return;

        // If focused on an input/textarea, only handle navigation keys
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
            if (context === 'fridge') {
                this.handleFridgeInput(e);
            }
            return;
        }

        // Block key repeat (except arrows in fridge for scrolling)
        if (e.repeat) {
            if (context === 'fridge' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                // allow held arrows
            } else {
                return;
            }
        }

        switch (context) {
            case 'fridge':
                this.handleFridge(e);
                break;
            case 'artifact':
                this.handleArtifact(e);
                break;
            case 'settings':
                this.handleSettings(e);
                break;
            case 'settings-sub':
                this.handleSettingsSub(e);
                break;
            case 'gameplay':
                this.handleGameplay(e);
                break;
        }
    }

    // --- Context handlers ---

    handleFridgeInput(e) {
        // Only handle nav keys when typing in fridge search
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const items = this.getVisibleFridgeItems();
            if (items.length === 0) return;
            this.fridgeHighlightIndex = Math.min(this.fridgeHighlightIndex + 1, items.length - 1);
            this.updateFridgeHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.fridgeHighlightIndex = Math.max(this.fridgeHighlightIndex - 1, 0);
            this.updateFridgeHighlight();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const items = this.getVisibleFridgeItems();
            if (this.fridgeHighlightIndex >= 0 && this.fridgeHighlightIndex < items.length) {
                items[this.fridgeHighlightIndex].click();
                this.fridgeHighlightIndex = -1;
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.callbacks.onCloseFridge();
            this.resetFridgeHighlight();
        }
    }

    handleFridge(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const items = this.getVisibleFridgeItems();
            if (items.length === 0) return;
            this.fridgeHighlightIndex = Math.min(this.fridgeHighlightIndex + 1, items.length - 1);
            this.updateFridgeHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.fridgeHighlightIndex = Math.max(this.fridgeHighlightIndex - 1, 0);
            this.updateFridgeHighlight();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const items = this.getVisibleFridgeItems();
            if (this.fridgeHighlightIndex >= 0 && this.fridgeHighlightIndex < items.length) {
                items[this.fridgeHighlightIndex].click();
                this.fridgeHighlightIndex = -1;
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.callbacks.onCloseFridge();
            this.resetFridgeHighlight();
        }
    }

    handleArtifact(e) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 3 && this.artifactIds && this.artifactSelectCallback) {
            const index = num - 1;
            if (index < this.artifactIds.length) {
                e.preventDefault();
                this.artifactSelectCallback(this.artifactIds[index]);
            }
        }
    }

    handleSettings(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.callbacks.onHideSettings();
        }
    }

    handleSettingsSub(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.callbacks.onShowSettingsView();
        }
    }

    handleGameplay(e) {
        const key = e.key;

        // Number keys 1-9: toggle countertop selection
        const num = parseInt(key);
        if (num >= 1 && num <= 9) {
            e.preventDefault();
            this.callbacks.onToggleSelection(num - 1);
            return;
        }

        // 0: deselect all
        if (key === '0') {
            e.preventDefault();
            this.callbacks.onClearSelection();
            return;
        }

        const upper = key.toUpperCase();

        // Appliances
        switch (upper) {
            case 'Q':
                e.preventDefault();
                this.resetFridgeHighlight();
                this.callbacks.onUseFridge();
                return;
            case 'W':
                e.preventDefault();
                this.callbacks.onUsePan();
                return;
            case 'E':
                e.preventDefault();
                this.callbacks.onUseBoard();
                return;
            case 'R':
                e.preventDefault();
                this.callbacks.onUseAmp();
                return;
            case 'T':
                e.preventDefault();
                this.callbacks.onUseMicrowave();
                return;
            case 'Y':
                e.preventDefault();
                this.callbacks.onUseTrash();
                return;
        }

        // Consumable slots A-G (5 slots)
        const consumableKeys = ['A', 'S', 'D', 'F', 'G'];
        const slotIndex = consumableKeys.indexOf(upper);
        if (slotIndex !== -1) {
            e.preventDefault();
            const id = this.getConsumableIdBySlot(slotIndex);
            if (!id) return;
            if (e.shiftKey) {
                this.callbacks.onDiscardConsumableBySlot(id);
            } else {
                this.callbacks.onUseConsumableBySlot(id);
            }
            return;
        }

        // Actions
        switch (upper) {
            case 'Z':
                e.preventDefault();
                this.callbacks.onTasteTest();
                return;
            case 'X':
                e.preventDefault();
                this.callbacks.onServeCustomer();
                return;
        }

        // Escape: open settings
        if (key === 'Escape') {
            e.preventDefault();
            this.callbacks.onShowSettings();
            return;
        }
    }
}
