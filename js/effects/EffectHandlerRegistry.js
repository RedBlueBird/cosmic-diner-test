// EffectHandlerRegistry.js - Central registry for artifact effect handlers

// Map of hookName -> Map of artifactId -> handlerFn
const handlers = new Map();

/**
 * Register a handler for a specific hook and artifact.
 * @param {string} hookName - The hook to register under
 * @param {string} artifactId - The artifact this handler belongs to
 * @param {Function} handlerFn - The handler function
 */
export function registerHandler(hookName, artifactId, handlerFn) {
    if (!handlers.has(hookName)) {
        handlers.set(hookName, new Map());
    }
    handlers.get(hookName).set(artifactId, handlerFn);
}

/**
 * Run value-accumulating handlers for a hook.
 * Only fires handlers for artifacts the player actually owns.
 * @param {string} hookName - The hook to run
 * @param {string[]} activeArtifacts - Player's active artifact IDs
 * @param {Object} context - Context passed to each handler; must include defaultValue
 * @returns {*} The accumulated result
 */
export function runHook(hookName, activeArtifacts, context) {
    let result = context.defaultValue;
    const hookHandlers = handlers.get(hookName);
    if (!hookHandlers) return result;

    for (const artifactId of activeArtifacts) {
        const handler = hookHandlers.get(artifactId);
        if (handler) {
            result = handler(context, result);
        }
    }
    return result;
}

/**
 * Run side-effect handlers for a hook (no return value).
 * Only fires handlers for artifacts the player actually owns.
 * @param {string} hookName - The hook to run
 * @param {string[]} activeArtifacts - Player's active artifact IDs
 * @param {Object} context - Context passed to each handler
 */
export function runEffectHook(hookName, activeArtifacts, context) {
    const hookHandlers = handlers.get(hookName);
    if (!hookHandlers) return;

    for (const artifactId of activeArtifacts) {
        const handler = hookHandlers.get(artifactId);
        if (handler) {
            handler(context);
        }
    }
}
