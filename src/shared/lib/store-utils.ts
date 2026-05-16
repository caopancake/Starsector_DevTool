/**
 * Utility functions for store management
 */

/**
 * Get the next active key after one is removed from a collection
 * Useful for maintaining activeKey state when removing items from Map/Set
 *
 * @param activeKey - The currently active key, or null
 * @param allKeys - All available keys
 * @param removedKey - The key being removed
 * @param fallback - What to return if no keys remain (default: null)
 * @returns The next active key, or fallback if none available
 *
 * @example
 * const remaining = getNextActiveKeyAfterRemoval(activeModRoot, [...stateMap.keys()], removedModRoot, null);
 */
export function getNextActiveKeyAfterRemoval<K>(activeKey: K | null, allKeys: K[], removedKey: K, fallback: K | null = null): K | null {
  // If the active key is not being removed, keep it
  if (activeKey !== removedKey) {
    return activeKey;
  }

  // Active key is being removed, find the next one
  const remaining = allKeys.filter((k) => k !== removedKey);
  return remaining.length > 0 ? remaining[0] : fallback;
}
