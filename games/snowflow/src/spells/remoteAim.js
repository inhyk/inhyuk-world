/**
 * The camera a remote player's spells think they have.
 *
 * Every spell reads its aim off a `CameraRig`: forward for the waves and the
 * comet, right and up for the ribbon's figure-eights, an eye for the placed
 * spells, and `addTrauma` when something lands. A replica has no camera — it
 * has three numbers off the wire. This is those numbers wearing the rig's
 * shape, so the nine spells run unmodified against it. `addTrauma` is empty
 * on purpose: a friend's comet must not shake *your* view.
 */

import { Vector3 } from "@babylonjs/core/Maths/math.vector";

const WORLD_UP = new Vector3(0, 1, 0);

export class RemoteAim {
    constructor() {
        this.forward = new Vector3(0, 0, 1);
        this.right = new Vector3(1, 0, 0);
        this.up = new Vector3(0, 1, 0);
        this.yaw = 0;
        /** The eye: a little above and behind the body, like the real rig. */
        this.camera = { position: new Vector3() };
        this.distance = 4;
    }

    /**
     * @param {number} ax @param {number} ay @param {number} az unit aim
     * @param {Vector3} body feet position
     */
    set(ax, ay, az, body) {
        const length = Math.hypot(ax, ay, az) || 1;
        this.forward.set(ax / length, ay / length, az / length);
        Vector3.CrossToRef(WORLD_UP, this.forward, this.right);
        if (this.right.lengthSquared() < 1e-6) this.right.set(1, 0, 0);
        this.right.normalize();
        Vector3.CrossToRef(this.forward, this.right, this.up);
        this.up.normalize();
        this.yaw = Math.atan2(this.forward.x, this.forward.z);
        this.camera.position.set(
            body.x - this.forward.x * this.distance,
            body.y + 1.6 - this.forward.y * this.distance,
            body.z - this.forward.z * this.distance
        );
    }

    addTrauma() { /* not your camera */ }
    getFlatForward(out) { out.set(this.forward.x, 0, this.forward.z).normalize(); return out; }
    getFlatRight(out) { out.set(this.right.x, 0, this.right.z).normalize(); return out; }
}
