/**
 * Snowballs in flight.
 *
 * Renderer-independent, like the night encounters: a fixed pool, a bounded
 * step, and a hit test that has to be right rather than fast. It is the pure
 * half of `src/world/snowball.js`.
 *
 * Two decisions worth stating.
 *
 * The step is *sub-stepped by distance*, not by time. A ball leaves the hand at
 * up to 26 m/s, which is 43 cm in a frame at 60 Hz and nearly a metre on a
 * heavy one — comfortably enough to pass clean through a 55 cm-wide mage
 * between two frames. Nobody would ever see why the throw missed. Splitting the
 * move into 20 cm pieces costs a handful of distance checks and removes the
 * whole class of complaint.
 *
 * Gravity is 18 m/s², not 9.8. A real snowball thrown across forty metres of
 * snowfield spends three seconds in the air on a lazy arc; at double gravity it
 * spends one and a half on an arc you can actually lead a moving target with.
 * This is the same reasoning the rest of the demo uses for its constants: the
 * number that reads correctly wins over the number that is correct.
 */

export const MAX_BALLS = 16;

const GRAVITY = 18;
/** Quadratic air drag coefficient. Small — a snowball is dense. */
const DRAG = 0.02;
/** The ball itself, metres. */
export const BALL_RADIUS = 0.15;
/** Longest a ball can live before it is returned to the pool. */
const MAX_LIFE = 6;
/** Sub-step length, metres. */
const STEP = 0.2;

export class Ballistics {
    /**
     * @param {object} hooks
     * @param {(x:number,z:number)=>number} hooks.heightAt
     * @param {(ball:any, target:any|null)=>void} [hooks.onImpact]
     * @param {(ball:any)=>void} [hooks.onTrail] once per ball per step
     */
    constructor({ heightAt, onImpact = () => {}, onTrail = () => {} }) {
        this.heightAt = heightAt;
        this.onImpact = onImpact;
        this.onTrail = onTrail;
        this.balls = Array.from({ length: MAX_BALLS }, (_, id) => ({
            id, active: false,
            x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
            age: 0, spin: 0,
            /** Who threw it. Their own body is not a target. */
            owner: "",
            /** True when this client threw it, so only one client scores it. */
            mine: false,
        }));
    }

    get liveCount() { return this.balls.reduce((n, b) => n + (b.active ? 1 : 0), 0); }

    /**
     * @param {number} x @param {number} y @param {number} z
     * @param {number} vx @param {number} vy @param {number} vz
     * @param {string} owner @param {boolean} mine
     * @returns {object|null} the ball, or null when the pool is full
     */
    launch(x, y, z, vx, vy, vz, owner = "", mine = false) {
        const ball = this.balls.find((b) => !b.active);
        if (!ball) return null;
        ball.active = true;
        ball.x = x; ball.y = y; ball.z = z;
        ball.vx = vx; ball.vy = vy; ball.vz = vz;
        ball.age = 0;
        ball.spin = Math.random() * Math.PI * 2;
        ball.owner = owner;
        ball.mine = mine;
        return ball;
    }

    clear() { for (const b of this.balls) b.active = false; }

    /**
     * @param {number} dt
     * @param {Array<{id:string, x:number, y:number, z:number, rise:number, radius:number}>} targets
     *   `rise` is how far above the target's feet its centre sits.
     */
    update(dt, targets) {
        if (!(dt > 0)) return;
        const h = Math.min(dt, 1 / 30);

        for (const ball of this.balls) {
            if (!ball.active) continue;
            ball.age += h;
            if (ball.age > MAX_LIFE) { ball.active = false; continue; }

            const speed = Math.hypot(ball.vx, ball.vy, ball.vz);
            const drag = 1 - Math.min(0.5, DRAG * speed * h);
            ball.vx *= drag;
            ball.vy = ball.vy * drag - GRAVITY * h;
            ball.vz *= drag;
            ball.spin += speed * h * 1.6;

            const travel = Math.hypot(ball.vx, ball.vy, ball.vz) * h;
            const steps = Math.max(1, Math.min(24, Math.ceil(travel / STEP)));
            const sh = h / steps;
            let done = false;

            for (let s = 0; s < steps && !done; s++) {
                ball.x += ball.vx * sh;
                ball.y += ball.vy * sh;
                ball.z += ball.vz * sh;

                const hit = this._hitAt(ball, targets);
                if (hit) {
                    ball.active = false;
                    this.onImpact(ball, hit);
                    done = true;
                    break;
                }
                const ground = this.heightAt(ball.x, ball.z);
                if (ball.y - BALL_RADIUS <= ground) {
                    ball.y = ground;
                    ball.active = false;
                    this.onImpact(ball, null);
                    done = true;
                }
            }
            if (!done) this.onTrail(ball);
        }
    }

    _hitAt(ball, targets) {
        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            // You cannot hit yourself with your own throw, however wild it was.
            if (t.id && t.id === ball.owner) continue;
            const dx = ball.x - t.x;
            const dy = ball.y - (t.y + t.rise);
            const dz = ball.z - t.z;
            const reach = t.radius + BALL_RADIUS;
            if (dx * dx + dy * dy + dz * dz <= reach * reach) return t;
        }
        return null;
    }
}

/**
 * Launch velocity for a throw.
 *
 * Aimed straight down the camera ray with a lift that scales *against* pitch:
 * looking at the horizon needs a lob to reach anything, looking down at
 * someone's boots needs none. Without that the same key throws short at long
 * range and sails over at short range, and it reads as the game being
 * inconsistent rather than as the player misjudging.
 *
 * @param {number} ax @param {number} ay @param {number} az unit aim
 * @param {number} charge 0..1
 * @param {Float32Array|number[]} out
 */
export function throwVelocity(ax, ay, az, charge, out) {
    const speed = 15 + 12 * Math.min(1, Math.max(0, charge));
    // How level the aim is, 1 at the horizon and 0 straight up or down.
    const level = Math.max(0, 1 - Math.abs(ay));
    const lift = 0.20 * level;
    out[0] = ax * speed;
    out[1] = (ay + lift) * speed;
    out[2] = az * speed;
    return out;
}
