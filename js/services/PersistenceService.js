/**
 * PersistenceService - Handles localStorage operations for Recipe Book
 * Singleton pattern for centralized persistence management
 */

const STORAGE_KEY = 'cosmicDiner_recipeBook';
const KEYBINDINGS_STORAGE_KEY = 'cosmicDiner_keybindings';
const RUN_DATA_STORAGE_KEY = 'cosmicDiner_lastRun';
const VERSION = 1;
const MAX_DISCOVERIES_PER_FOOD = 50; // Prevent quota issues

class PersistenceService {
    constructor() {
        this.cache = null;
    }

    /**
     * Get default empty recipe book structure
     */
    getDefaultStructure() {
        return {
            version: VERSION,
            discoveries: {}
        };
    }

    /**
     * Load recipe book from localStorage
     * @returns {Object} Recipe book data
     */
    loadRecipeBook() {
        if (this.cache) {
            return this.cache;
        }

        try {
            const data = localStorage.getItem(STORAGE_KEY);

            if (!data) {
                this.cache = this.getDefaultStructure();
                return this.cache;
            }

            const parsed = JSON.parse(data);

            // Validate structure
            if (!parsed.version || !parsed.discoveries || typeof parsed.discoveries !== 'object') {
                console.warn('Invalid recipe book data, resetting...');
                this.cache = this.getDefaultStructure();
                this.saveRecipeBook();
                return this.cache;
            }

            this.cache = parsed;
            return this.cache;

        } catch (error) {
            console.error('Error loading recipe book:', error);
            this.cache = this.getDefaultStructure();
            return this.cache;
        }
    }

    /**
     * Save recipe book to localStorage
     * @param {Object} data - Recipe book data (optional, uses cache if not provided)
     */
    saveRecipeBook(data = null) {
        try {
            const toSave = data || this.cache;

            if (!toSave) {
                console.warn('No data to save');
                return false;
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
            this.cache = toSave;
            return true;

        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.warn('Storage quota exceeded, cleaning up...');
                this.cleanupOldEntries();
                // Try again after cleanup
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
                    return true;
                } catch (retryError) {
                    console.error('Failed to save after cleanup:', retryError);
                    return false;
                }
            } else {
                console.error('Error saving recipe book:', error);
                return false;
            }
        }
    }

    /**
     * Add a discovery to the recipe book (deduplicates automatically)
     * @param {string} foodName - Name of the food
     * @param {Object} discovery - Discovery object { method, ingredients?, source?, timestamp }
     */
    addDiscovery(foodName, discovery) {
        if (!this.cache) {
            this.loadRecipeBook();
        }

        // Initialize food entry if doesn't exist
        if (!this.cache.discoveries[foodName]) {
            this.cache.discoveries[foodName] = [];
        }

        // Create signature for duplicate detection
        const signature = this.getDiscoverySignature(discovery);

        // Check if discovery already exists
        const exists = this.cache.discoveries[foodName].some(d => {
            return this.getDiscoverySignature(d) === signature;
        });

        if (!exists) {
            // Add timestamp if not provided
            if (!discovery.timestamp) {
                discovery.timestamp = Date.now();
            }

            this.cache.discoveries[foodName].push(discovery);

            // Limit discoveries per food to prevent quota issues
            if (this.cache.discoveries[foodName].length > MAX_DISCOVERIES_PER_FOOD) {
                // Keep only the most recent entries
                this.cache.discoveries[foodName].sort((a, b) => b.timestamp - a.timestamp);
                this.cache.discoveries[foodName] = this.cache.discoveries[foodName].slice(0, MAX_DISCOVERIES_PER_FOOD);
            }

            this.saveRecipeBook();
        }
    }

    /**
     * Create unique signature for discovery to detect duplicates
     */
    getDiscoverySignature(discovery) {
        if (discovery.method === 'Pan' && discovery.ingredients) {
            return `Pan:${[...discovery.ingredients].sort().join('+')}`;
        } else if (discovery.method === 'Atom') {
            return 'Atom';
        } else if (discovery.source) {
            return `${discovery.method}:${discovery.source}`;
        }
        return discovery.method;
    }

    /**
     * Get all discoveries for all foods
     * @returns {Object} Complete discoveries object
     */
    getAllDiscoveries() {
        if (!this.cache) {
            this.loadRecipeBook();
        }
        return this.cache.discoveries;
    }

    /**
     * Cleanup old entries to free up space
     */
    cleanupOldEntries() {
        if (!this.cache) {
            this.loadRecipeBook();
        }

        // Remove oldest 20% of entries from each food
        Object.keys(this.cache.discoveries).forEach(foodName => {
            const discoveries = this.cache.discoveries[foodName];
            if (discoveries.length > 10) {
                discoveries.sort((a, b) => b.timestamp - a.timestamp);
                const keepCount = Math.floor(discoveries.length * 0.8);
                this.cache.discoveries[foodName] = discoveries.slice(0, keepCount);
            }
        });

        this.saveRecipeBook();
    }

    /**
     * Clear all recipe book data (for testing/reset)
     */
    clearAll() {
        this.cache = this.getDefaultStructure();
        this.saveRecipeBook();
    }

    /**
     * Load keybindings from localStorage
     * @returns {Object|null} Keybindings object or null if not found
     */
    loadKeybindings() {
        try {
            const data = localStorage.getItem(KEYBINDINGS_STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading keybindings:', error);
            return null;
        }
    }

    /**
     * Save keybindings to localStorage
     * @param {Object} bindings - Keybindings map
     */
    saveKeybindings(bindings) {
        try {
            localStorage.setItem(KEYBINDINGS_STORAGE_KEY, JSON.stringify(bindings));
        } catch (error) {
            console.error('Error saving keybindings:', error);
        }
    }

    /**
     * Clear keybindings from localStorage
     */
    clearKeybindings() {
        localStorage.removeItem(KEYBINDINGS_STORAGE_KEY);
    }

    /**
     * Save run data for meta-progression (Time Overseer)
     * @param {Object} data - { day, beatBoss }
     */
    saveRunData(data) {
        try {
            localStorage.setItem(RUN_DATA_STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving run data:', error);
        }
    }

    /**
     * Load last run data for meta-progression
     * @returns {Object|null} { day, beatBoss } or null if no previous run
     */
    loadRunData() {
        try {
            const data = localStorage.getItem(RUN_DATA_STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading run data:', error);
            return null;
        }
    }
}

// Export singleton instance
export default new PersistenceService();
