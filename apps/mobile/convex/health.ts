import { query } from "./_generated/server";

/**
 * Lightweight public health-check query.
 *
 * Called by the boot screen to verify the backend is alive before letting the
 * user into the game.  Returns a server timestamp and the minimum client
 * version the backend expects.  If the client's version is below this, the
 * boot screen tells the user to update.
 */
export const ping = query({
  args: {},
  handler: async () => ({
    ok: true as const,
    ts: Date.now(),
    /**
     * Minimum client version the backend supports.
     * Bump this when you ship a breaking backend change that requires a new
     * client build.  The client compares against its own `APP_VERSION`.
     *
     * Format: simple integer that only goes up.
     */
    minClientVersion: 1,
  }),
});
