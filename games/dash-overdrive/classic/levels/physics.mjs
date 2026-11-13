// Copy of the engine's player physics (engine/src/Player.cpp, LevelManager.cpp)
// for checking levels in Node. Every float operation is rounded with
// Math.fround so results match the C++ float math bit for bit; a browser test
// (verify.mjs) compares this file with the real WebAssembly engine.
const f = Math.fround;

export const TILE = 120;
export const FLOOR_Y = 936;
const HEIGHT = 1296;
const MIN_Y = HEIGHT - 3 * TILE - 50 * TILE;
const X_VELOCITY = f(20.772);
const JUMP = f(-44.72);
const PAD = f(-64);
const GRAVITY = f(3.456);
const CONTACT_REACH = 2;
const LOOK_BEHIND = 2 * TILE;
const BOUNDS_HEIGHT = (HEIGHT - 10 * TILE) / 2;
// plan 2 (engine/include/Player.h): speed gates, coloured orbs and pads, ball, UFO, wave
export const SPEED_MULTIPLIERS = [f(0.8), f(1), f(1.25), f(1.5)];
export const X_VELOCITIES = SPEED_MULTIPLIERS.map(multiplier => f(X_VELOCITY * multiplier));
export const NORMAL_SPEED = 1;
const PINK_ORB_JUMP = f(-32);
const PINK_PAD_JUMP = f(-42);
const BLUE_ORB_PUSH = f(12);
const BLUE_PAD_PUSH = f(16);
const BALL_GRAVITY = f(2.2);
const BALL_FLIP_SPEED = f(12);
const BALL_MAX_SPEED = f(44);
const UFO_GRAVITY = f(2.3);
const UFO_HOP = f(-30);
const UFO_MAX_RISE = f(60);
const UFO_MAX_FALL = f(30);
const WAVE_INSET = TILE / 3;
// Gamemode numbers in the engine (sim_mode, online "m")
export const MODES = ['cube', 'ship', 'ball', 'ufo', 'wave'];

export const SPEED_PER_FRAME = X_VELOCITY;
export const speedOf = player => X_VELOCITIES[player.speed];

// id -> type, hitbox [x, y, w, h] in texture pixels, texture size
export const OBJECTS = {
  1: {type: 'block', hitbox: [0, 0, 120, 120], w: 120, h: 120},
  2: {type: 'block', hitbox: [0, 0, 120, 120], w: 120, h: 120},
  3: {type: 'block', hitbox: [0, 0, 120, 120], w: 120, h: 120},
  4: {type: 'block', hitbox: [0, 0, 120, 120], w: 120, h: 120},
  5: {type: 'deco', w: 120, h: 120},
  6: {type: 'block', hitbox: [0, 0, 120, 120], w: 120, h: 120},
  7: {type: 'block', hitbox: [0, 0, 120, 120], w: 120, h: 120},
  8: {type: 'hazard', hitbox: [48, 36, 24, 48], w: 120, h: 120},
  9: {type: 'hazard', hitbox: [42, f(30.4), 36, f(43.2)], w: 120, h: 104},
  10: {type: 'normalPortal', hitbox: [10, -4, 100, 300], w: 96, h: 292},
  11: {type: 'upsidePortal', hitbox: [10, -4, 100, 300], w: 95, h: 292},
  12: {type: 'cubePortal', hitbox: [-4, -4, 136, 344], w: 132, h: 335},
  13: {type: 'shipPortal', hitbox: [-4, -4, 136, 344], w: 133, h: 335},
  15: {type: 'deco', w: 24, h: 168},
  16: {type: 'deco', w: 24, h: 104},
  17: {type: 'deco', w: 20, h: 48},
  18: {type: 'deco', w: 508, h: 164},
  19: {type: 'deco', w: 416, h: 144},
  20: {type: 'deco', w: 288, h: 116},
  21: {type: 'deco', w: 168, h: 52},
  29: {type: 'bgTrigger', w: 0, h: 0},
  30: {type: 'groundTrigger', w: 0, h: 0},
  35: {type: 'pad', hitbox: [-10, 0, 100, 16], w: 100, h: 16},
  36: {type: 'orb', hitbox: [-12, -12, 144, 144], w: 120, h: 120},
  39: {type: 'hazard', hitbox: [48, f(15.8), 24, f(22.4)], w: 120, h: 54},
  40: {type: 'block', hitbox: [0, 0, 120, 54], w: 120, h: 54},
  41: {type: 'deco', w: 78, h: 278},
  202: {type: 'block', hitbox: [0, 0, 120, 120], w: 120, h: 120},
  203: {type: 'block', hitbox: [0, 0, 120, 54], w: 120, h: 54},
  // coins are picked up but never change the movement
  201: {type: 'coin', hitbox: [20, 20, 80, 80], w: 120, h: 120},
  // a key on the tower's floors: collected like a coin
  204: {type: 'coin', hitbox: [20, 20, 80, 80], w: 120, h: 120},
  210: {type: 'ballPortal', hitbox: [-4, -4, 136, 344], w: 132, h: 335},
  211: {type: 'ufoPortal', hitbox: [-4, -4, 136, 344], w: 132, h: 335},
  212: {type: 'wavePortal', hitbox: [-4, -4, 136, 344], w: 132, h: 335},
  213: {type: 'speed', speed: 0, hitbox: [5, -60, 100, 270], w: 110, h: 150},
  214: {type: 'speed', speed: 1, hitbox: [5, -60, 100, 270], w: 110, h: 150},
  215: {type: 'speed', speed: 2, hitbox: [5, -60, 100, 270], w: 110, h: 150},
  216: {type: 'speed', speed: 3, hitbox: [5, -60, 100, 270], w: 110, h: 150},
  220: {type: 'pinkOrb', hitbox: [-12, -12, 144, 144], w: 120, h: 120},
  221: {type: 'blueOrb', hitbox: [-12, -12, 144, 144], w: 120, h: 120},
  222: {type: 'pinkPad', hitbox: [-10, 0, 100, 16], w: 100, h: 16},
  223: {type: 'bluePad', hitbox: [-10, 0, 100, 16], w: 100, h: 16},
};

function rotateHitbox([x, y, w, h], rotations) {
  if (rotations === 0) return [x, y, w, h];
  while (rotations < 0) rotations += 4;
  const cx = f(x + f(w / 2));
  const cy = f(y + f(h / 2));
  let rx = f(x - cx);
  let ry = f(y - cy);
  let rw = w;
  let rh = h;
  for (let i = 0; i < rotations; i++) {
    const nx = f(-ry - rh);
    const ny = rx;
    rx = nx;
    ry = ny;
    [rw, rh] = [rh, rw];
  }
  return [f(rx + cx), f(ry + cy), rw, rh];
}

function parseObject(text) {
  const parts = text.split(',');
  let id = 1;
  let data = OBJECTS[1];
  let x = 0;
  let y = 0;
  let flipX = false;
  let flipY = false;
  let rotation = 0;
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const key = parseInt(parts[i], 10);
    const value = parts[i + 1];
    if (key === 1) {
      id = parseInt(value, 10);
      if (OBJECTS[id]) data = OBJECTS[id];
    } else if (key === 2) {
      x = f(f(f(parseFloat(value)) * 4) - Math.trunc(data.w / 2));
    } else if (key === 3) {
      y = f(f(FLOOR_Y - f(f(f(parseFloat(value)) * 4) + Math.trunc(data.h / 2))) + 0);
    } else if (key === 4) {
      flipX = parseInt(value, 10) === 1;
    } else if (key === 5) {
      flipY = parseInt(value, 10) === 1;
    } else if (key === 6) {
      rotation = Math.trunc(parseInt(value, 10) / 90);
    }
  }
  if (!OBJECTS[id]) return null;
  let hitbox = null;
  if (data.hitbox) {
    const offset = rotateHitbox(data.hitbox, rotation);
    if (flipX) offset[0] = f(f(data.w - offset[0]) - offset[2]);
    if (flipY) offset[1] = f(f(data.h - offset[1]) - offset[3]);
    hitbox = {x: f(offset[0] + x), y: f(offset[1] + y), w: offset[2], h: offset[3]};
  }
  return {id, type: data.type, speed: data.speed, x, y, w: data.w, h: data.h, hitbox};
}

// Parses a level string the same way LevelManager::loadLevelData does.
export function parseLevel(text) {
  const parts = text.split(';');
  const objects = [];
  let furthestX = 0;
  for (const part of parts.slice(1)) {
    if (part === '') continue;
    const object = parseObject(part);
    if (!object) continue;
    furthestX = Math.max(furthestX, Math.trunc(f(object.x + object.w)));
    if (object.type === 'bgTrigger' || object.type === 'groundTrigger') continue;
    object.index = objects.length;
    objects.push(object);
  }
  // Array.prototype.sort is stable, like std::stable_sort.
  const collidables = objects.filter(object => object.hitbox).sort((a, b) => a.hitbox.x - b.hitbox.x);
  return {objects, collidables, furthestX};
}

function overlaps(a, b) {
  return a.x < f(b.x + b.w) && f(a.x + a.w) > b.x && a.y < f(b.y + b.h) && f(a.y + a.h) > b.y;
}

function firstCollidableFrom(collidables, x) {
  let low = 0;
  let high = collidables.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (collidables[middle].hitbox.x < x) low = middle + 1;
    else high = middle;
  }
  return low;
}

function roundf(value) {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}

export function newPlayer() {
  return {
    x: -TILE, y: FLOOR_Y - TILE, prevY: FLOOR_Y - TILE, posX: -TILE, posY: FLOOR_Y - TILE,
    vy: 0, grounded: true, held: false, dead: false, buffered: false,
    hasBounds: false, gravity: 1, mode: 'cube', speed: NORMAL_SPEED, boundsTop: 0, boundsBottom: 0,
    pressed: [],
  };
}

export function clonePlayer(player) {
  return {...player, pressed: player.pressed.slice()};
}

function die(player) {
  player.dead = true;
}

function setBounds(player, portal) {
  const rounded = roundf(f(portal.y / TILE));
  let cameraY = f(f(f(rounded - 3) * TILE) - BOUNDS_HEIGHT);
  cameraY = Math.min(Math.max(cameraY, -10000), -3 * TILE + BOUNDS_HEIGHT);
  player.boundsTop = f(cameraY + BOUNDS_HEIGHT);
  player.boundsBottom = f(player.boundsTop + 10 * TILE);
  player.hasBounds = true;
}

function updatePhysics(player, dt, clicked, released) {
  const g = player.gravity;
  const xVelocity = speedOf(player);
  if (player.mode === 'cube') {
    if (clicked) player.buffered = true;
    else if (released) player.buffered = false;
    if (player.grounded && player.held) {
      player.vy = f(JUMP * g);
      player.grounded = false;
    }
    if (!player.grounded) player.vy = f(player.vy + f(f(GRAVITY * g) * dt));
    player.vy = Math.min(Math.max(player.vy, -60), 60);
  } else if (player.mode === 'ship') {
    let accel = f(GRAVITY * f(0.32));
    if (player.held) {
      accel = f(accel * f(-1.25));
      if (f(player.vy * g) > f(-8 * GRAVITY)) accel = f(accel * f(1.25));
    } else if (f(player.vy * g) <= f(-8 * GRAVITY)) {
      accel = f(accel * f(1.5));
    }
    player.vy = f(player.vy + f(f(accel * g) * dt));
    player.vy = f(Math.min(Math.max(f(player.vy / g), -32), f(25.6)) * g);
  } else if (player.mode === 'ball') {
    if (clicked) player.buffered = true;
    else if (released) player.buffered = false;
    if (player.grounded && player.buffered) {
      player.buffered = false;
      player.gravity = -player.gravity;
      player.vy = f(BALL_FLIP_SPEED * player.gravity);
      player.grounded = false;
    }
    player.vy = f(player.vy + f(f(BALL_GRAVITY * player.gravity) * dt));
    player.vy = Math.min(Math.max(player.vy, -BALL_MAX_SPEED), BALL_MAX_SPEED);
  } else if (player.mode === 'ufo') {
    if (clicked) {
      player.buffered = true;
      player.vy = f(UFO_HOP * g);
      player.grounded = false;
    } else if (released) {
      player.buffered = false;
    }
    player.vy = f(player.vy + f(f(UFO_GRAVITY * g) * dt));
    player.vy = f(Math.min(Math.max(f(player.vy / g), -UFO_MAX_RISE), UFO_MAX_FALL) * g);
  } else {
    if (clicked) player.buffered = true;
    else if (released) player.buffered = false;
    const slope = f(xVelocity / f(0.9));
    player.vy = f((player.held ? -slope : slope) * g);
  }
  player.x = f(player.x + f(xVelocity * dt));
  player.y = f(player.y + f(f(player.vy * dt) * f(0.9)));
}

function collideWithGround(player) {
  if (player.mode === 'cube') {
    if (player.hasBounds) {
      if (player.gravity === -1 && player.vy <= 0 && player.y <= player.boundsTop) {
        player.y = player.boundsTop;
        player.grounded = true;
        player.vy = 0;
      }
      if (f(player.y + TILE) > player.boundsBottom) {
        player.y = f(player.boundsBottom - TILE);
        if (player.vy > 0) player.vy = 0;
      }
    } else if (player.gravity === 1) {
      if (player.vy >= 0 && f(player.y + TILE) >= FLOOR_Y) {
        player.y = FLOOR_Y - TILE;
        player.grounded = true;
        player.vy = 0;
      }
    } else if (f(player.y + TILE) > FLOOR_Y) {
      player.y = FLOOR_Y - TILE;
      if (player.vy > 0) player.vy = 0;
    }
  } else if (player.mode === 'ship') {
    if (player.y < player.boundsTop) {
      player.y = player.boundsTop;
      player.vy = 0;
    }
    if (f(player.y + TILE) > player.boundsBottom) {
      player.y = f(player.boundsBottom - TILE);
      player.grounded = true;
      player.vy = 0;
    }
  } else {
    // ball, UFO and wave: the wave's small box touches the floor and ceiling
    const inset = player.mode === 'wave' ? WAVE_INSET : 0;
    const floorY = player.hasBounds ? player.boundsBottom : FLOOR_Y;
    if (f(f(player.y + TILE) - inset) >= floorY) {
      if (player.gravity === 1 && player.vy >= 0) {
        player.y = f(f(floorY - TILE) + inset);
        player.vy = 0;
        player.grounded = true;
      } else if (f(f(player.y + TILE) - inset) > floorY) {
        player.y = f(f(floorY - TILE) + inset);
        if (player.vy > 0) player.vy = 0;
      }
    }
    if (player.hasBounds && f(player.y + inset) <= player.boundsTop) {
      if (player.gravity === -1 && player.vy <= 0) {
        player.y = f(player.boundsTop - inset);
        player.vy = 0;
        player.grounded = true;
      } else if (f(player.y + inset) < player.boundsTop) {
        player.y = f(player.boundsTop - inset);
        if (player.vy < 0) player.vy = 0;
      }
    }
  }
}

function inner(player) {
  return {x: f(player.x + 40), y: f(player.y + 40), w: 40, h: 40};
}

function collideCubeWithBlock(player, block) {
  const box = inner(player);
  if (player.gravity === 1) {
    const wasAbove = f(player.prevY + TILE) <= f(block.y + CONTACT_REACH);
    const innerAbove = f(box.y + box.h) <= block.y;
    if (player.vy >= 0 && (wasAbove || innerAbove)) {
      player.y = f(block.y - TILE);
      player.vy = 0;
      player.grounded = true;
      return;
    }
  } else {
    const blockBottom = f(block.y + block.h);
    const wasBelow = player.prevY >= f(blockBottom - CONTACT_REACH);
    const innerBelow = box.y >= blockBottom;
    if (player.vy <= 0 && (wasBelow || innerBelow)) {
      player.y = blockBottom;
      player.vy = 0;
      player.grounded = true;
      return;
    }
  }
  if (overlaps(box, block)) die(player);
}

function collideShipWithBlock(player, block) {
  if (overlaps(inner(player), block)) {
    die(player);
    return;
  }
  const blockBottom = f(block.y + block.h);
  if (player.vy > 0 && f(player.prevY + TILE) <= f(block.y + CONTACT_REACH) && f(player.y + TILE) >= block.y) {
    player.y = f(block.y - TILE);
    player.vy = 0;
    if (player.mode === 'ufo' && player.gravity === 1) player.grounded = true;
  } else if (player.vy < 0 && player.prevY >= f(blockBottom - CONTACT_REACH) && player.y <= blockBottom) {
    player.y = blockBottom;
    player.vy = 0;
    if (player.mode === 'ufo' && player.gravity === -1) player.grounded = true;
  }
}

function collideWaveWithBlock(player, block) {
  if (!overlaps(inner(player), block)) return;
  const blockBottom = f(block.y + block.h);
  if (player.vy > 0 && f(f(player.prevY + TILE) - WAVE_INSET) <= f(block.y + CONTACT_REACH)) {
    player.y = f(f(block.y - TILE) + WAVE_INSET);
    player.vy = 0;
    if (player.gravity === 1) player.grounded = true;
  } else if (player.vy < 0 && f(player.prevY + WAVE_INSET) >= f(blockBottom - CONTACT_REACH)) {
    player.y = f(blockBottom - WAVE_INSET);
    player.vy = 0;
    if (player.gravity === -1) player.grounded = true;
  } else {
    die(player);
  }
}

function setGravity(player, gravity, object) {
  player.gravity = gravity;
  player.grounded = false;
  if (player.mode === 'cube') {
    if (gravity === -1 && !player.hasBounds) setBounds(player, object);
    else if (gravity === 1) player.hasBounds = false;
  }
}

function collideWithObject(player, object) {
  const hitbox = object.hitbox;
  const wave = player.mode === 'wave';
  switch (object.type) {
    case 'hazard':
      if (overlaps(wave ? inner(player) : {x: player.x, y: player.y, w: TILE, h: TILE}, hitbox)) die(player);
      break;
    case 'block':
      if (player.mode === 'cube' || player.mode === 'ball') collideCubeWithBlock(player, hitbox);
      else if (wave) collideWaveWithBlock(player, hitbox);
      else collideShipWithBlock(player, hitbox);
      break;
    case 'pad':
    case 'pinkPad':
      if (wave) break;
      player.vy = f((object.type === 'pad' ? PAD : PINK_PAD_JUMP) * player.gravity);
      player.grounded = false;
      break;
    case 'bluePad':
      if (!player.pressed.includes(object.index)) {
        player.pressed.push(object.index);
        setGravity(player, -player.gravity, object);
        player.vy = f(BLUE_PAD_PUSH * player.gravity);
      }
      break;
    case 'orb':
    case 'pinkOrb':
      if (!wave && player.buffered && !player.pressed.includes(object.index)) {
        player.vy = f((object.type === 'orb' ? JUMP : PINK_ORB_JUMP) * player.gravity);
        player.grounded = false;
        player.pressed.push(object.index);
        if (player.mode === 'ball') player.buffered = false;
      }
      break;
    case 'blueOrb':
      if (player.buffered && !player.pressed.includes(object.index)) {
        player.pressed.push(object.index);
        setGravity(player, -player.gravity, object);
        player.vy = f(BLUE_ORB_PUSH * player.gravity);
        if (player.mode === 'ball') player.buffered = false;
      }
      break;
    case 'upsidePortal':
      if (player.gravity === -1) break;
      player.vy = 0; // a portal starts the new mode fresh
      setGravity(player, -1, object);
      break;
    case 'normalPortal':
      if (player.gravity === 1) break;
      player.vy = 0; // a portal starts the new mode fresh
      setGravity(player, 1, object);
      break;
    case 'shipPortal':
      if (player.mode !== 'ship') player.vy = 0; // a portal starts the new mode fresh
      player.mode = 'ship';
      setBounds(player, object);
      break;
    case 'ballPortal':
      if (player.mode !== 'ball') {
        player.vy = 0; // a portal starts the new mode fresh
        player.mode = 'ball';
        player.grounded = false;
        player.buffered = false;
      }
      setBounds(player, object);
      break;
    case 'ufoPortal':
      if (player.mode !== 'ufo') {
        player.vy = 0; // a portal starts the new mode fresh
        player.mode = 'ufo';
      }
      setBounds(player, object);
      break;
    case 'wavePortal':
      player.mode = 'wave';
      setBounds(player, object);
      break;
    case 'cubePortal':
      if (player.mode !== 'cube') {
        player.vy = 0; // a portal starts the new mode fresh
        player.mode = 'cube';
        player.hasBounds = player.gravity === -1;
      }
      break;
    case 'speed':
      player.speed = object.speed;
      break;
  }
}

function handleCollisions(player, level) {
  if (player.mode !== 'ship') player.grounded = false;
  collideWithGround(player);
  const collidables = level.collidables;
  for (let i = firstCollidableFrom(collidables, f(player.x - LOOK_BEHIND)); i < collidables.length; i++) {
    const object = collidables[i];
    const hitbox = object.hitbox;
    if (hitbox.x >= f(player.x + TILE)) break;
    const probe = object.type === 'block' && (player.mode === 'cube' || player.mode === 'ball')
      ? {x: player.x, y: f(player.y - CONTACT_REACH), w: TILE, h: TILE + 2 * CONTACT_REACH}
      : {x: player.x, y: player.y, w: TILE, h: TILE};
    if (overlaps(probe, hitbox)) {
      collideWithObject(player, object);
      if (player.dead) return;
    }
  }
  if (player.mode === 'ship') player.grounded = player.vy === 0 && !player.held;
  player.posX = player.x;
  player.posY = player.y;
}

// One frame of Player::simUpdate. Returns 0 running, 1 dead, 2 reached the end.
export function step(player, level, held, dt) {
  const clicked = !player.held && held;
  const released = player.held && !held;
  player.held = held;
  if (player.dead) return 1;
  updatePhysics(player, dt, clicked, released);
  handleCollisions(player, level);
  if (player.dead) return 1;
  if (player.posY < MIN_Y) {
    die(player);
    return 1;
  }
  // cube and ship clicks wait for an orb until landing, the ball's until let go,
  // UFO and wave clicks only count on their own frame
  if (player.mode === 'ufo' || player.mode === 'wave' || (player.grounded && player.mode !== 'ball')) player.buffered = false;
  player.prevY = player.posY;
  if (player.posX > level.furthestX) return 2;
  return 0;
}
