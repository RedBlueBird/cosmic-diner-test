// KeybindManager.js - Keyboard shortcut handling with rebindable keys

import { DEFAULT_KEYBINDINGS, BLOCKED_REBIND_KEYS } from '../config.js';
import persistence from '../services/PersistenceService.js';

export class KeybindManager {
    constructor(gameState, callbacks) {
        this.state = gameState;
        this.callbacks = callbacks;

        // Load bindings: saved overrides merged onto defaults
        const saved = persistence.loadKeybindings();
        this.bindings = { ...DEFAULT_KEYBINDINGS, ...(saved || {}) };
        this.keyMap = this.buildKeyMap();

        // Rebind state (set when hovering a keybind item)
        this.rebindTarget = null;

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

    // --- Key normalization & mapping ---

    normalizeKey(key) {
        return key.length === 1 ? key.toUpperCase() : key;
    }

    buildKeyMap() {
        const map = {};
        for (const [action, key] of Object.entries(this.bindings)) {
            map[this.normalizeKey(key)] = action;
        }
        return map;
    }

    // --- Public API for bindings ---

    getBindings() {
        return { ...this.bindings };
    }

    getKeyForAction(action) {
        return this.bindings[action] || null;
    }

    rebind(action, newKey) {
        const normalized = this.normalizeKey(newKey);
        const oldKey = this.bindings[action];

        // Find conflict: another action already using this key
        const conflictAction = this.keyMap[normalized];
        let swapped = null;

        if (conflictAction && conflictAction !== action) {
            // Swap: give conflicting action the old key
            this.bindings[conflictAction] = oldKey;
            swapped = conflictAction;
        }

        this.bindings[action] = newKey.length === 1 ? newKey.toUpperCase() : newKey;
        this.keyMap = this.buildKeyMap();
        persistence.saveKeybindings(this.bindings);

        return swapped;
    }

    resetToDefaults() {
        this.bindings = { ...DEFAULT_KEYBINDINGS };
        this.keyMap = this.buildKeyMap();
        persistence.clearKeybindings();
    }

    setRebindTarget(action) {
        this.rebindTarget = action;
    }

    clearRebindTarget() {
        this.rebindTarget = null;
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
            const keybindsView = document.getElementById('keybinds-view');
            if (keybindsView && !keybindsView.classList.contains('hidden')) return 'keybinds';
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

        // Check for overseer, merchant shop or feedback view (sub-contexts of gameplay)
        const overseerShop = document.getElementById('overseer-shop');
        if (overseerShop && !overseerShop.classList.contains('hidden')) return 'overseer';

        const merchantShop = document.getElementById('merchant-shop');
        if (merchantShop && !merchantShop.classList.contains('hidden')) return 'merchant';

        const feedbackView = document.getElementById('feedback-view');
        if (feedbackView && !feedbackView.classList.contains('hidden')) return 'feedback';

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
            case 'keybinds':
                this.handleKeybinds(e);
                break;
            case 'overseer':
                this.handleOverseer(e);
                break;
            case 'merchant':
                this.handleMerchant(e);
                break;
            case 'feedback':
                this.handleFeedback(e);
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
        const normalized = this.normalizeKey(e.key);
        const action = this.keyMap[normalized];
        if (action && action.startsWith('slot') && this.artifactIds && this.artifactSelectCallback) {
            const index = parseInt(action.replace('slot', '')) - 1;
            if (index >= 0 && index < this.artifactIds.length) {
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

    handleKeybinds(e) {
        // If hovering a keybind item and pressing a non-blocked key, rebind it
        if (this.rebindTarget && !BLOCKED_REBIND_KEYS.includes(e.key)) {
            e.preventDefault();
            const swapped = this.rebind(this.rebindTarget, e.key);
            if (this.callbacks.onKeybindChanged) {
                this.callbacks.onKeybindChanged(this.rebindTarget, swapped);
            }
            return;
        }

        // Escape goes back to settings view
        if (e.key === 'Escape') {
            e.preventDefault();
            this.callbacks.onShowSettingsView();
        }
    }

    // Helper: resolve slot action from shift+key (uses e.code for shift-safe lookup)
    resolveShiftSlotAction(e) {
        // First try normal key lookup (works for non-symbol keys)
        const normalized = this.normalizeKey(e.key);
        const action = this.keyMap[normalized];
        if (action && action.startsWith('slot')) return action;

        // Fallback: check e.code for digit keys (shift+1 produces '!' but code is 'Digit1')
        if (e.code && e.code.startsWith('Digit')) {
            const digit = e.code.replace('Digit', '');
            const digitAction = this.keyMap[digit];
            if (digitAction && digitAction.startsWith('slot')) return digitAction;
        }

        return null;
    }

    handleOverseer(e) {
        // Confirm key = collect/skip (only without shift)
        const normalized = this.normalizeKey(e.key);
        const action = this.keyMap[normalized];

        if (!e.shiftKey && action === 'confirm') {
            e.preventDefault();
            this.callbacks.onOverseerAction();
            return;
        }

        // Shift + slot keys (1-9) = toggle offering selection
        if (e.shiftKey) {
            const slotAction = this.resolveShiftSlotAction(e);
            if (slotAction) {
                const slotNum = parseInt(slotAction.replace('slot', ''));
                if (slotNum >= 1 && slotNum <= 9) {
                    e.preventDefault();
                    this.callbacks.onSelectOffering(slotNum - 1);
                }
                return;
            }
        }

        // Fall through to gameplay for all other keys
        this.handleGameplay(e);
    }

    handleMerchant(e) {
        // Confirm key = leave shop (only without shift)
        const normalized = this.normalizeKey(e.key);
        const action = this.keyMap[normalized];

        if (!e.shiftKey && action === 'confirm') {
            e.preventDefault();
            this.callbacks.onDismissMerchant();
            return;
        }

        // Shift + slot keys (1-9) = buy merchant items from combined list
        if (e.shiftKey) {
            const slotAction = this.resolveShiftSlotAction(e);
            if (slotAction) {
                const slotNum = parseInt(slotAction.replace('slot', ''));
                if (slotNum >= 1 && slotNum <= 9) {
                    e.preventDefault();
                    this.callbacks.onBuyMerchantItem(slotNum - 1);
                }
                return;
            }
        }

        // Fall through to gameplay for all other keys (countertop selection, appliances, etc.)
        this.handleGameplay(e);
    }

    handleFeedback(e) {
        // Confirm key = collect payment (only without shift)
        const normalized = this.normalizeKey(e.key);
        const action = this.keyMap[normalized];

        if (!e.shiftKey && action === 'confirm') {
            e.preventDefault();
            this.callbacks.onCollectPayment();
            return;
        }

        // Shift + slot keys (1-9) = toggle payment item selection
        if (e.shiftKey) {
            const slotAction = this.resolveShiftSlotAction(e);
            if (slotAction) {
                const slotNum = parseInt(slotAction.replace('slot', ''));
                if (slotNum >= 1 && slotNum <= 9) {
                    e.preventDefault();
                    this.callbacks.onTogglePaymentSelection(slotNum - 1);
                }
                return;
            }
        }

        // Fall through to gameplay for all other keys (countertop selection, appliances, etc.)
        this.handleGameplay(e);
    }

    handleGameplay(e) {
        const normalized = this.normalizeKey(e.key);
        const action = this.keyMap[normalized];

        if (!action) return;

        // confirm key is only used in merchant/feedback contexts
        if (action === 'confirm') return;

        e.preventDefault();

        // Countertop slot selection (slot1-slot9)
        if (action.startsWith('slot')) {
            const index = parseInt(action.replace('slot', '')) - 1;
            this.callbacks.onToggleSelection(index);
            return;
        }

        // Deselect all
        if (action === 'deselectAll') {
            this.callbacks.onClearSelection();
            return;
        }

        // Consumable slots (consumable1-consumable5)
        if (action.startsWith('consumable')) {
            const slotIndex = parseInt(action.replace('consumable', '')) - 1;
            const id = this.getConsumableIdBySlot(slotIndex);
            if (!id) return;
            if (e.shiftKey) {
                this.callbacks.onDiscardConsumableBySlot(id);
            } else {
                this.callbacks.onUseConsumableBySlot(id);
            }
            return;
        }

        // Appliances and actions
        switch (action) {
            case 'fridge':
                this.resetFridgeHighlight();
                this.callbacks.onUseFridge();
                return;
            case 'pan':
                this.callbacks.onUsePan();
                return;
            case 'board':
                this.callbacks.onUseBoard();
                return;
            case 'amp':
                this.callbacks.onUseAmp();
                return;
            case 'microwave':
                this.callbacks.onUseMicrowave();
                return;
            case 'trash':
                this.callbacks.onUseTrash();
                return;
            case 'tasteTest':
                this.callbacks.onTasteTest();
                return;
            case 'serve':
                this.callbacks.onServeCustomer();
                return;
            case 'settings':
                this.callbacks.onShowSettings();
                return;
        }
    }
}
