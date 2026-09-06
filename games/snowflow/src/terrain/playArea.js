/**
 * The fence.
 *
 * One number, in a module of its own, because two very different things need
 * it: the heightfield, which clamps bodies to it, and the minimap, which draws
 * it. The heightfield cannot be imported without pulling in the GPU, and the
 * map's geometry has to be testable without one — the same reason
 * `encounters.js` lives apart from `monsters.js`.
 */

/** Half-extent the player is kept inside, leaving margin for the far rings. */
export const PLAY_RADIUS = 620;

/** Clamp a world position to the playable area, in place. */
export function clampToPlayArea(v) {
    const d = Math.hypot(v.x, v.z);
    if (d > PLAY_RADIUS) {
        const k = PLAY_RADIUS / d;
        v.x *= k;
        v.z *= k;
    }
}
