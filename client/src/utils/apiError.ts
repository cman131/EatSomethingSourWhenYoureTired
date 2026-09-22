// apiRequest (client/src/services/api.ts) throws an Error carrying the server's message when one
// was sent. Shared so every mutation (purchases, equips, loadout actions, …) surfaces the same
// server-provided reason instead of a generic fallback whenever one is available.
export const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;
