// Contract between building builders (src/sites/*.js) and the game.
//
// A builder returns makeSite(...) filled in. Everything is in the site's LOCAL space:
//   origin = centre of the footprint at ground level (y = 0 is the outside ground),
//   +X = right, +Y = up, the main entrance faces +Z (towards the road), metres.
// The game places the site with a position and a yaw that is a multiple of 90 degrees.
//
// Fields:
//   group         THREE.Group with everything. Call bake() (geom.js) on static parts; mark moving or
//                 breakable things with userData.dynamic = true so bake() leaves them alone.
//   footprint     {w, d}: outer size on X and Z (the builder must stay inside it).
//   colliders     [{min:[x,y,z], max:[x,y,z]}]: solid boxes (walls, counters, beds, big furniture,
//                 floor slabs, steps). The player is a 0.3 m radius, 1.75 m tall capsule that can step
//                 up 0.4 m. Leave doorways (at least 1.1 m wide) free.
//   interactables [{id, label, pos:[x,y,z], radius, seat?}]: things the player uses with E.
//                 label is the Korean prompt ('세수하기'). pos is where the prompt appears and is
//                 measured from (eye height ~1.6). seat = {pos:[x,y,z] eye position, yaw, pitch}
//                 camera pose while using it (yaw 0 looks towards -Z, PI/2 towards -X).
//                 Optional screen = {center:[x,y,z], w, h, yaw}: a monitor face the game overlays UI on.
//   doors         [{pivot, openAngle, collider, auto, slide}]: pivot is an Object3D (dynamic) that
//                 rotates about Y by openAngle (hinged) or moves by slide [dx,dy,dz] (sliding).
//                 collider is the closed-door box. auto: opens by itself when someone is near.
//   lamps         [{pos:[x,y,z], color, intensity, range}]: where real lights should be when dark or
//                 indoors (the game moves a small pool of point lights to the nearest anchors).
//   nightGlow     [Material]: emissive materials (lit windows, signs) whose glow rises at night.
//   indoor        [{min, max}]: volumes that count as inside (lighting switches to the room probe).
//   npcSpots      [{pos:[x,y,z], yaw, pose:'sit'|'stand'|'type', role}]: where people sit or stand.
//   parking       {pos:[x,y,z], yaw}: car parking spot in front (on the site's own pavement).
//   spawn         {pos:[x,y,z], yaw}: optional start point.
//   extra         anything else the game needs (e.g. grillTop for the restaurant).
import * as THREE from 'three';

export function makeSite(name, w, d) {
  return {
    name,
    group: new THREE.Group(),
    footprint: { w, d },
    colliders: [],
    interactables: [],
    doors: [],
    lamps: [],
    nightGlow: [],
    indoor: [],
    npcSpots: [],
    parking: null,
    spawn: null,
    extra: {},
  };
}

/** Push a collider box given centre and size. */
export function solid(site, cx, cy, cz, sx, sy, sz) {
  site.colliders.push({ min: [cx - sx / 2, cy - sy / 2, cz - sz / 2], max: [cx + sx / 2, cy + sy / 2, cz + sz / 2] });
}
