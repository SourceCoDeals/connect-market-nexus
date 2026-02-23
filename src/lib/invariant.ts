/**
 * Runtime assertion that narrows types.
 *
 * Throws an `Error` with the given message when `condition` is falsy.
 * After the call the TypeScript compiler knows `condition` is truthy,
 * so it can be used for type-narrowing:
 *
 * ```ts
 * const user: User | null = getUser();
 * invariant(user, 'Expected user to be defined');
 * // `user` is now typed as `User`
 * ```
 */
export function invariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violation: ${message}`);
  }
}

/**
 * Soft assertion that logs a warning instead of throwing.
 * Useful in non-critical paths where you want to flag unexpected state
 * without crashing the application.
 */
export function softInvariant(
  condition: unknown,
  message: string,
): condition is true {
  if (!condition) {
    console.warn(`Soft invariant violation: ${message}`);
    return false;
  }
  return true;
}
