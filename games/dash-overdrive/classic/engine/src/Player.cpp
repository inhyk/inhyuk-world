#include <algorithm>
#include <SDL_image.h>
#include <cmath>
#include <iostream>
#include "PlayingState.h"
#include "Game.h"
#include "Object.h"

// The level checker (games/dash-overdrive/classic/levels/physics.mjs) repeats
// this movement and collision code line by line. Change both together.

namespace {
constexpr float DEGREES_TO_RADIANS = 0.01745329252f;
constexpr float TILE = static_cast<float>(Config::TILE_SIZE);
constexpr float FLOOR_Y = static_cast<float>(Config::FLOOR_Y);
// A cube resting on a block must keep touching it, so block tests reach this
// far above and below the cube, and a landing may start this far inside.
constexpr float CONTACT_REACH = 2.0f;
// Collision only looks at objects whose hitbox starts after this far behind the
// player. No hitbox is wider than this.
constexpr float LOOK_BEHIND = 2 * TILE;

bool overlaps(const SDL_FRect &a, const SDL_FRect &b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

float rotatedCubeExtent(float halfSize, float radians) {
    return halfSize * (std::abs(std::cos(radians)) + std::abs(std::sin(radians)));
}

float cubeVisualOffset(float radians, int gravityMultiplier, bool movingTowardLanding) {
    if (!movingTowardLanding) {
        return 0;
    }
    const float halfSize = Config::TILE_SIZE / 2.0f;
    const float extent = rotatedCubeExtent(halfSize, radians);
    return gravityMultiplier * (extent - halfSize);
}

}

void Player::init(Game *game) {
    m_Game = game;
    m_Renderer = m_Game->getRenderer();
    m_ShipTexture = IMG_LoadTexture(m_Renderer, "res/gfx/ship.png");
    if (m_ShipTexture == nullptr) {
        std::cerr << "Failed to load ship.png! " << SDL_GetError() << std::endl;
    }
    SDL_QueryTexture(m_ShipTexture, NULL, NULL, &m_ShipWidth, &m_ShipHeight);
    m_BallTexture = IMG_LoadTexture(m_Renderer, "res/gfx/ball.png");
    m_UfoTexture = IMG_LoadTexture(m_Renderer, "res/gfx/ufo.png");
    m_WaveTexture = IMG_LoadTexture(m_Renderer, "res/gfx/wave.png");
    if (m_BallTexture == nullptr || m_UfoTexture == nullptr || m_WaveTexture == nullptr) {
        std::cerr << "Failed to load ball, ufo or wave.png! " << SDL_GetError() << std::endl;
    }
    m_DebrisTexture = IMG_LoadTexture(m_Renderer, "res/gfx/debris.png");
    m_CheckpointTexture = IMG_LoadTexture(m_Renderer, "res/gfx/checkpoint.png");
    if (m_CheckpointTexture == nullptr) {
        std::cerr << "Failed to load checkpoint.png! " << SDL_GetError() << std::endl;
    }
    m_DeathSound = Mix_LoadWAV("res/sfx/deathSound.ogg");
    if (m_DeathSound == nullptr) {
        std::cerr << "Failed to load deathSound.ogg! " << SDL_GetError() << std::endl;
    }
    m_CoinSound = Mix_LoadWAV("res/sfx/coin.ogg");
    if (m_CoinSound == nullptr) {
        std::cerr << "Failed to load coin.ogg! " << SDL_GetError() << std::endl;
    }
}

void Player::reset() {
    m_Position = { -TILE, FLOOR_Y - TILE };
    m_PreviousPosition = m_Position;
    m_YVelocity = 0;
    m_Rotation = 0;
    m_TargetRotation = 0;
    m_Hitbox = { m_Position.x, m_Position.y, TILE, TILE };
    m_IsGrounded = true;
    m_IsMouseHeld = false;
    m_HasBufferedOrb = false;
    m_HasBounds = false;
    m_IsDead = false;
    m_DeadTimer = 0;
    m_GravityMultiplier = 1;
    m_Gamemode = Gamemode::CUBE;
    setSpeed(NORMAL_SPEED);
    m_Trail.clear();
    m_PressedOrbs.clear();
    m_Checkpoints.clear();
    m_Coins = 0;
    for (Trigger &trigger : PlayingState::get().getTriggers()) {
        trigger.reset();
    }
}

Player::~Player() {
    SDL_DestroyTexture(m_ShipTexture);
    SDL_DestroyTexture(m_BallTexture);
    SDL_DestroyTexture(m_UfoTexture);
    SDL_DestroyTexture(m_WaveTexture);
    SDL_DestroyTexture(m_CheckpointTexture);
    SDL_DestroyTexture(m_DebrisTexture);
    Mix_FreeChunk(m_DeathSound);
    Mix_FreeChunk(m_CoinSound);
}

void Player::update(float deltaTime) {
    m_SimInput = false;
    m_WalkDirection = (m_Game->isRightHeld() ? 1 : 0) - (m_Game->isLeftHeld() ? 1 : 0);
    bool mouseClicked = (!m_IsMouseHeld && m_Game->isSpaceHeld()) ||
                        (!m_IsMouseHeld && m_Game->isUpHeld());
    bool mouseReleased = (m_IsMouseHeld && !m_Game->isMouseHeld()) &&
                         (m_IsMouseHeld && !m_Game->isSpaceHeld()) &&
                         (m_IsMouseHeld && !m_Game->isUpHeld());

    m_IsMouseHeld = m_Game->isSpaceHeld() || m_Game->isUpHeld();

    // if it shouldn't ignore mouse clicks, it won't
    if (!PlayingState::get().playerShouldIgnoreMouseClicks()) {
        mouseClicked = mouseClicked || (!m_IsMouseHeld && m_Game->isMouseHeld());
        m_IsMouseHeld = m_IsMouseHeld || m_Game->isMouseHeld();
    }
    step(deltaTime, mouseClicked, mouseReleased);
}

void Player::simUpdateButtons(int buttons, float deltaTime) {
    m_SimInput = true;
    m_WalkDirection = ((buttons & 4) ? 1 : 0) - ((buttons & 2) ? 1 : 0);
    const bool held = (buttons & 1) != 0;
    const bool mouseClicked = !m_IsMouseHeld && held;
    const bool mouseReleased = m_IsMouseHeld && !held;
    m_IsMouseHeld = held;
    step(deltaTime, mouseClicked, mouseReleased);
}

void Player::simUpdate(bool held, float deltaTime) {
    m_SimInput = true;
    m_WalkDirection = 0;
    const bool mouseClicked = !m_IsMouseHeld && held;
    const bool mouseReleased = m_IsMouseHeld && !held;
    m_IsMouseHeld = held;
    step(deltaTime, mouseClicked, mouseReleased);
}

void Player::step(float deltaTime, bool mouseClicked, bool mouseReleased) {
    if (m_IsDead) {
        m_DeadTimer -= deltaTime;
        if (!m_SimInput) {
            updateDebris(deltaTime);
        }
        if (m_DeadTimer < 0 && !PlayingState::get().isSpectating()) {
            respawn();
        }
        return;
    }

    updatePhysics(deltaTime, mouseClicked, mouseReleased);
    handleCollisions();
    if (m_IsDead) {
        return;
    }
    activateTriggers(PlayingState::get().getTriggers());

    switch (m_Gamemode) {
    case Gamemode::CUBE:
        if (m_Platformer) {
            m_Rotation = 0;
            m_TargetRotation = 0;
        } else {
            updateCubeRotation(deltaTime);
        }
        break;
    case Gamemode::SHIP:
        updateShipRotation(deltaTime);
        break;
    default:
        updateOtherRotation(deltaTime);
        break;
    }

    scrollCamera();
    if (!m_SimInput) {
        updateTrail();
    }

    if (m_Position.y < PlayingState::get().getMinY()) {
        die();
    }
    // A cube or ship click is kept for an orb until it lands; the ball keeps it
    // until the button is let go (it flips on landing); UFO and wave clicks only
    // count on the frame they happen.
    if (m_Gamemode == Gamemode::UFO || m_Gamemode == Gamemode::WAVE ||
        (m_IsGrounded && m_Gamemode != Gamemode::BALL)) {
        m_HasBufferedOrb = false;
    }
    m_PreviousPosition = m_Position;
}

PlayerSimState Player::saveSimState() const {
    PlayerSimState state {
        m_Position,
        m_PreviousPosition,
        m_Hitbox,
        m_YVelocity,
        m_Rotation,
        m_TargetRotation,
        m_IsGrounded,
        m_IsMouseHeld,
        m_IsDead,
        m_HasBufferedOrb,
        m_HasBounds,
        m_GravityMultiplier,
        m_Gamemode,
        m_Speed,
        m_Bounds,
        {},
        m_Coins
    };
    const LevelManager &level = PlayingState::get().getLevel();
    for (const Object *orb : m_PressedOrbs) {
        state.pressedOrbs.push_back(level.indexOf(orb));
    }
    return state;
}

void Player::restoreSimState(const PlayerSimState &state) {
    m_Position = state.position;
    m_PreviousPosition = state.previousPosition;
    m_Hitbox = state.hitbox;
    m_YVelocity = state.yVelocity;
    m_Rotation = state.rotation;
    m_TargetRotation = state.targetRotation;
    m_IsGrounded = state.isGrounded;
    m_IsMouseHeld = state.isMouseHeld;
    m_IsDead = state.isDead;
    m_HasBufferedOrb = state.hasBufferedOrb;
    m_HasBounds = state.hasBounds;
    m_GravityMultiplier = state.gravityMultiplier;
    m_Gamemode = state.gamemode;
    setSpeed(state.speed);
    m_Bounds = state.bounds;
    m_Coins = state.coins;
    m_PressedOrbs.clear();
    const LevelManager &level = PlayingState::get().getLevel();
    for (int index : state.pressedOrbs) {
        m_PressedOrbs.insert(&level.getObjects()[index]);
    }
}

void Player::placeCheckpoint() {
    Background &background = m_Game->getBackground();
    Ground &ground = m_Game->getGround();
    m_Checkpoints.push_back(Checkpoint {
        m_Position,
        m_Game->getCameraPosition(),
        m_YVelocity,
        m_Rotation,
        m_TargetRotation,
        m_GravityMultiplier,
        m_Gamemode,
        m_Speed,
        m_HasBounds,
        m_Bounds,
        background.getColor(),
        ground.getColor(),
        background.getTargetColor(),
        ground.getTargetColor(),
        background.getFadeTime(),
        ground.getFadeTime()
    });
}

void Player::removeCheckpoint() {
    if (!m_Checkpoints.empty()) {
        m_Checkpoints.pop_back();
    }
}

void Player::respawn() {
    m_Gamemode = Gamemode::CUBE;
    m_Trail.clear();
    m_PressedOrbs.clear();
    m_IsDead = false;
    m_IsGrounded = false;
    m_HasBufferedOrb = false;
    Background &background = m_Game->getBackground();
    Ground &ground = m_Game->getGround();
    if (!PlayingState::get().isInPractice() || m_Checkpoints.empty()) {
        m_Coins = 0;
        m_Hitbox.x = -TILE;
        m_Hitbox.y = FLOOR_Y - TILE;
        m_Game->setCameraPosition({0, 0});
        m_Rotation = 0;
        m_TargetRotation = 0;
        m_GravityMultiplier = 1;
        m_YVelocity = 0;
        m_HasBounds = false;
        // a fresh attempt always starts at normal speed
        setSpeed(NORMAL_SPEED);
        for (Trigger &trigger : PlayingState::get().getTriggers()) {
            trigger.reset();
        }
        SDL_Color initialBackground = PlayingState::get().getInitialBackground();
        SDL_Color initialGround = PlayingState::get().getInitialGround();
        background.fade(initialBackground.r, initialBackground.g, initialBackground.b, 0);
        ground.fade(initialGround.r, initialGround.g, initialGround.b, 0);
    } else {
        const Checkpoint &latestCheckpoint = m_Checkpoints.back();
        m_Hitbox.x = latestCheckpoint.position.x;
        m_Hitbox.y = latestCheckpoint.position.y;
        m_Game->setCameraPosition(latestCheckpoint.cameraPosition);
        m_Rotation = latestCheckpoint.rotation;
        m_TargetRotation = latestCheckpoint.targetRotation;
        m_GravityMultiplier = latestCheckpoint.gravityMultiplier;
        m_YVelocity = latestCheckpoint.yVelocity;
        m_Gamemode = latestCheckpoint.gamemode;
        setSpeed(latestCheckpoint.speed);
        m_HasBounds = latestCheckpoint.hasBounds;
        m_Bounds = latestCheckpoint.bounds;
        background.setColor(latestCheckpoint.backgroundColor);
        ground.setColor(latestCheckpoint.groundColor);
        background.setTargetColor(latestCheckpoint.backgroundTargetColor);
        ground.setTargetColor(latestCheckpoint.groundTargetColor);
        background.setFadeTime(latestCheckpoint.backgroundFadeTime);
        ground.setFadeTime(latestCheckpoint.groundFadeTime);
        for (Trigger &trigger : PlayingState::get().getTriggers()) {
            bool passedBeforeCheckpoint = m_Hitbox.x > trigger.getPos().x + Config::TILE_SIZE/2;
            if (!passedBeforeCheckpoint) {
                trigger.reset();
            }
        }
    }
    m_Position = { m_Hitbox.x, m_Hitbox.y };
    m_PreviousPosition = m_Position;
}

void Player::updatePhysics(float deltaTime, bool mouseClicked, bool mouseReleased) {
    const float gravityMultiplier = static_cast<float>(m_GravityMultiplier);
    switch (m_Gamemode) {
    case Gamemode::CUBE:
        if (mouseClicked) {
            m_HasBufferedOrb = true;
        } else if (mouseReleased) {
            m_HasBufferedOrb = false;
        }
        if (m_IsGrounded && m_IsMouseHeld) {
            m_YVelocity = m_JumpStrength * gravityMultiplier;
            m_IsGrounded = false;
        }
        if (!m_IsGrounded) {
            m_YVelocity += m_Gravity * gravityMultiplier * deltaTime;
        }
        m_YVelocity = std::clamp(m_YVelocity, -TILE / 2, TILE / 2);
        break;
    case Gamemode::SHIP: {
        // https://github.com/camila314/gdp/blob/cfde712de31d3fd57e5fe6f49e54db34890e98ee/finished_works/PlayerObject/updateJump.cpp#L18
        float shipAccel = m_Gravity * 0.32f;
        if (m_IsMouseHeld) {
            shipAccel *= -1.25f;
            // give boost
            if (m_YVelocity * gravityMultiplier > -8 * m_Gravity) {
                shipAccel *= 1.25f;
            }
        } else if (m_YVelocity * gravityMultiplier <= -8 * m_Gravity) {
            shipAccel *= 1.5f;
        }
        m_YVelocity += shipAccel * gravityMultiplier * deltaTime;
        m_YVelocity = std::clamp(m_YVelocity / gravityMultiplier, -32.0f, 25.6f) * gravityMultiplier;
        break;
    }
    case Gamemode::BALL: {
        // A click (or a press held from the air until it lands) while touching
        // the floor or the ceiling flips gravity.
        if (mouseClicked) {
            m_HasBufferedOrb = true;
        } else if (mouseReleased) {
            m_HasBufferedOrb = false;
        }
        if (m_IsGrounded && m_HasBufferedOrb) {
            m_HasBufferedOrb = false;
            m_GravityMultiplier = -m_GravityMultiplier;
            m_YVelocity = BALL_FLIP_SPEED * static_cast<float>(m_GravityMultiplier);
            m_IsGrounded = false;
        }
        const float ballGravity = static_cast<float>(m_GravityMultiplier);
        m_YVelocity += BALL_GRAVITY * ballGravity * deltaTime;
        m_YVelocity = std::clamp(m_YVelocity, -BALL_MAX_SPEED, BALL_MAX_SPEED);
        break;
    }
    case Gamemode::UFO:
        // every click is a hop, also in the air
        if (mouseClicked) {
            m_HasBufferedOrb = true;
            m_YVelocity = UFO_HOP * gravityMultiplier;
            m_IsGrounded = false;
        } else if (mouseReleased) {
            m_HasBufferedOrb = false;
        }
        m_YVelocity += UFO_GRAVITY * gravityMultiplier * deltaTime;
        m_YVelocity = std::clamp(m_YVelocity / gravityMultiplier, -UFO_MAX_RISE, UFO_MAX_FALL) * gravityMultiplier;
        break;
    case Gamemode::WAVE: {
        // straight lines at 45 degrees: up while held, down when let go
        if (mouseClicked) {
            m_HasBufferedOrb = true;
        } else if (mouseReleased) {
            m_HasBufferedOrb = false;
        }
        const float slope = m_XVelocity / 0.9f;
        m_YVelocity = (m_IsMouseHeld ? -slope : slope) * gravityMultiplier;
        break;
    }
    }
    if (m_Platformer) {
        m_XVelocity = PLATFORM_SPEED * static_cast<float>(m_WalkDirection);
        if (m_WalkDirection != 0) m_FacingLeft = m_WalkDirection < 0;
    }
    m_Hitbox.x += m_XVelocity * deltaTime;
    m_Hitbox.y += m_YVelocity * deltaTime * 0.9f; // why the fuck does gd multiply by 0.9?
    // the tower's floors start at the left wall
    if (m_Platformer && m_Hitbox.x < -TILE) m_Hitbox.x = -TILE;
}

SDL_FRect Player::innerHitbox() const {
    return { m_Hitbox.x + TILE / 3, m_Hitbox.y + TILE / 3, TILE / 3, TILE / 3 };
}

void Player::handleCollisions() {
    if (m_Gamemode != Gamemode::SHIP) {
        m_IsGrounded = false;
    }
    collideWithGround();

    const LevelManager &level = PlayingState::get().getLevel();
    const std::vector<const Object *> &collidables = level.getCollidables();
    const std::size_t first = level.firstCollidableFrom(m_Hitbox.x - LOOK_BEHIND);
    for (std::size_t i = first; i < collidables.size(); i++) {
        const Object &object = *collidables[i];
        const SDL_FRect hitbox = object.getHitbox().value();
        if (hitbox.x >= m_Hitbox.x + m_Hitbox.w) {
            break;
        }
        SDL_FRect probe = m_Hitbox;
        if (object.getType() == ObjectType::BLOCK && (m_Gamemode == Gamemode::CUBE || m_Gamemode == Gamemode::BALL)) {
            probe.y -= CONTACT_REACH;
            probe.h += 2 * CONTACT_REACH;
        }
        if (overlaps(probe, hitbox)) {
            collideWithObject(object);
            if (m_IsDead) {
                return;
            }
        }
    }
    if (m_Gamemode == Gamemode::SHIP) {
        m_IsGrounded = m_YVelocity == 0 && !m_IsMouseHeld;
    }
    m_Position.x = m_Hitbox.x;
    m_Position.y = m_Hitbox.y;
}

void Player::collideWithObject(const Object &object) {
    const SDL_FRect hitbox = object.getHitbox().value();
    const bool wave = m_Gamemode == Gamemode::WAVE;
    switch (object.getType()) {
    case ObjectType::HAZARD:
        // the wave only dies when its small box touches
        if (overlaps(wave ? innerHitbox() : m_Hitbox, hitbox)) {
            die();
        }
        break;
    case ObjectType::BLOCK:
        switch (m_Gamemode) {
        case Gamemode::CUBE:
        case Gamemode::BALL:
            if (m_Platformer) collidePlatformerWithBlock(hitbox);
            else collideCubeWithBlock(hitbox);
            break;
        case Gamemode::WAVE:
            collideWaveWithBlock(hitbox);
            break;
        default:
            collideShipWithBlock(hitbox);
            break;
        }
        break;
    case ObjectType::PAD:
    case ObjectType::PINK_PAD:
        // the wave flies straight over yellow and pink pads
        if (wave) {
            break;
        }
        m_YVelocity = (object.getType() == ObjectType::PAD ? m_PadStrength : PINK_PAD_JUMP) * m_GravityMultiplier;
        // A pad wins over the floor touched in the same frame, otherwise a held
        // jump would replace the pad's launch on the next frame.
        m_IsGrounded = false;
        break;
    case ObjectType::BLUE_PAD:
        // flips gravity once, with a small push the new way
        if (m_PressedOrbs.count(&object) == 0) {
            m_PressedOrbs.insert(&object);
            setGravity(-m_GravityMultiplier, object);
            m_YVelocity = BLUE_PAD_PUSH * m_GravityMultiplier;
        }
        break;
    case ObjectType::ORB:
    case ObjectType::PINK_ORB: {
        const bool orbHasNotBeenPressed = m_PressedOrbs.count(&object) == 0;
        if (!wave && m_HasBufferedOrb && orbHasNotBeenPressed) {
            m_YVelocity = (object.getType() == ObjectType::ORB ? m_JumpStrength : PINK_ORB_JUMP) * m_GravityMultiplier;
            m_IsGrounded = false;
            m_PressedOrbs.insert(&object);
            if (m_Gamemode == Gamemode::BALL) {
                // the ball's click went to the orb, not to a flip on landing
                m_HasBufferedOrb = false;
            }
        }
        break;
    }
    case ObjectType::BLUE_ORB:
        if (m_HasBufferedOrb && m_PressedOrbs.count(&object) == 0) {
            m_PressedOrbs.insert(&object);
            setGravity(-m_GravityMultiplier, object);
            m_YVelocity = BLUE_ORB_PUSH * m_GravityMultiplier;
            if (m_Gamemode == Gamemode::BALL) {
                m_HasBufferedOrb = false;
            }
        }
        break;
    case ObjectType::COIN:
        // Coins never change the movement; the level checker relies on that.
        if (object.getCoinIndex() >= 0 && !hasCoin(object.getCoinIndex())) {
            m_Coins |= 1 << object.getCoinIndex();
            if (!m_SimInput) {
                Mix_PlayChannel(-1, m_CoinSound, 0);
            }
        }
        break;
    case ObjectType::UPSIDE_DOWN_PORTAL:
        if (m_GravityMultiplier == -1) {
            break;
        }
        m_YVelocity /= 2;
        setGravity(-1, object);
        break;
    case ObjectType::NORMAL_PORTAL:
        if (m_GravityMultiplier == 1) {
            break;
        }
        m_YVelocity /= 2;
        setGravity(1, object);
        break;
    case ObjectType::SHIP_PORTAL:
        if (m_Gamemode != Gamemode::SHIP) {
            m_YVelocity /= 2;
            m_Rotation = 0;
        }
        m_Gamemode = Gamemode::SHIP;
        setBounds(object);
        break;
    case ObjectType::BALL_PORTAL:
        if (m_Gamemode != Gamemode::BALL) {
            m_YVelocity /= 2;
            m_Gamemode = Gamemode::BALL;
            m_IsGrounded = false;
            // a press held from a cube jump is not a flip
            m_HasBufferedOrb = false;
        }
        setBounds(object);
        break;
    case ObjectType::UFO_PORTAL:
        if (m_Gamemode != Gamemode::UFO) {
            m_YVelocity /= 2;
            m_Rotation = 0;
            m_Gamemode = Gamemode::UFO;
        }
        setBounds(object);
        break;
    case ObjectType::WAVE_PORTAL:
        if (m_Gamemode != Gamemode::WAVE) {
            m_Rotation = 0;
            m_Trail.clear();
            m_Gamemode = Gamemode::WAVE;
        }
        setBounds(object);
        break;
    case ObjectType::CUBE_PORTAL:
        if (m_Gamemode != Gamemode::CUBE) {
            if (m_Gamemode != Gamemode::SHIP) {
                // land square again
                m_Rotation = std::round(m_Rotation / 90) * 90;
                m_TargetRotation = m_Rotation;
            }
            m_YVelocity /= 2;
            m_Gamemode = Gamemode::CUBE;
            m_HasBounds = m_GravityMultiplier == -1;
        }
        break;
    case ObjectType::SPEED_SLOW:
        setSpeed(0);
        break;
    case ObjectType::SPEED_NORMAL:
        setSpeed(1);
        break;
    case ObjectType::SPEED_FAST:
        setSpeed(2);
        break;
    case ObjectType::SPEED_VERY_FAST:
        setSpeed(3);
        break;
    default:
        break;
    }
}

// Gravity portals, blue orbs and blue pads. An upside-down cube gets a ceiling
// to run on, placed like a ship's; the right way up it follows the camera again.
void Player::setGravity(int gravity, const Object &object) {
    m_GravityMultiplier = gravity;
    m_IsGrounded = false;
    if (m_Gamemode == Gamemode::CUBE) {
        if (gravity == -1 && !m_HasBounds) {
            setBounds(object);
        } else if (gravity == 1) {
            m_HasBounds = false;
        }
    }
}

void Player::setSpeed(int speed) {
    m_Speed = std::clamp(speed, 0, SPEED_COUNT - 1);
    m_XVelocity = DEFAULT_X_VELOCITY * SPEED_MULTIPLIERS[m_Speed];
}

void Player::collideCubeWithBlock(const SDL_FRect &block) {
    const SDL_FRect inner = innerHitbox();
    if (m_GravityMultiplier == 1) {
        const bool wasAbove = m_PreviousPosition.y + TILE <= block.y + CONTACT_REACH;
        const bool innerAbove = inner.y + inner.h <= block.y;
        if (m_YVelocity >= 0 && (wasAbove || innerAbove)) {
            m_Hitbox.y = block.y - TILE;
            m_YVelocity = 0;
            m_IsGrounded = true;
            return;
        }
    } else {
        const float blockBottom = block.y + block.h;
        const bool wasBelow = m_PreviousPosition.y >= blockBottom - CONTACT_REACH;
        const bool innerBelow = inner.y >= blockBottom;
        if (m_YVelocity <= 0 && (wasBelow || innerBelow)) {
            m_Hitbox.y = blockBottom;
            m_YVelocity = 0;
            m_IsGrounded = true;
            return;
        }
    }
    if (overlaps(inner, block)) {
        die();
    }
}

// Tower floors: land on top, bump a ceiling from below, and stop at a side
// instead of breaking. Spikes still break the cube.
void Player::collidePlatformerWithBlock(const SDL_FRect &block) {
    const float blockBottom = block.y + block.h;
    const bool wasAbove = m_PreviousPosition.y + TILE <= block.y + CONTACT_REACH;
    const bool wasBelow = m_PreviousPosition.y >= blockBottom - CONTACT_REACH;
    const bool sideways = m_PreviousPosition.x + TILE <= block.x + CONTACT_REACH || m_PreviousPosition.x >= block.x + block.w - CONTACT_REACH;
    if (m_YVelocity >= 0 && wasAbove && !(sideways && m_PreviousPosition.y + TILE > block.y)) {
        m_Hitbox.y = block.y - TILE;
        m_YVelocity = 0;
        m_IsGrounded = true;
        return;
    }
    if (!overlaps(m_Hitbox, block)) {
        return;
    }
    if (m_YVelocity < 0 && wasBelow && !sideways) {
        m_Hitbox.y = blockBottom;
        m_YVelocity = 0;
        return;
    }
    // a wall: back out the way the cube came
    if (m_PreviousPosition.x + TILE <= block.x + CONTACT_REACH) {
        m_Hitbox.x = block.x - TILE;
    } else if (m_PreviousPosition.x >= block.x + block.w - CONTACT_REACH) {
        m_Hitbox.x = block.x + block.w;
    } else if (m_Hitbox.y + TILE / 2 < block.y + block.h / 2) {
        // came in from a corner: stand on it
        m_Hitbox.y = block.y - TILE;
        m_YVelocity = 0;
        m_IsGrounded = true;
    } else {
        m_Hitbox.y = blockBottom;
        if (m_YVelocity < 0) m_YVelocity = 0;
    }
}

void Player::collideShipWithBlock(const SDL_FRect &block) {
    if (overlaps(innerHitbox(), block)) {
        die();
        return;
    }
    const float blockBottom = block.y + block.h;
    if (m_YVelocity > 0 && m_PreviousPosition.y + TILE <= block.y + CONTACT_REACH && m_Hitbox.y + TILE >= block.y) {
        m_Hitbox.y = block.y - TILE;
        m_YVelocity = 0;
        // a UFO stands on a block (upside down it hangs under one)
        if (m_Gamemode == Gamemode::UFO && m_GravityMultiplier == 1) {
            m_IsGrounded = true;
        }
    } else if (m_YVelocity < 0 && m_PreviousPosition.y >= blockBottom - CONTACT_REACH && m_Hitbox.y <= blockBottom) {
        m_Hitbox.y = blockBottom;
        m_YVelocity = 0;
        if (m_Gamemode == Gamemode::UFO && m_GravityMultiplier == -1) {
            m_IsGrounded = true;
        }
    }
}

// The wave slides along a block it meets from above or below and breaks on its
// side. Only its small inner box counts.
void Player::collideWaveWithBlock(const SDL_FRect &block) {
    if (!overlaps(innerHitbox(), block)) {
        return;
    }
    const float inset = TILE / 3;
    const float blockBottom = block.y + block.h;
    if (m_YVelocity > 0 && m_PreviousPosition.y + TILE - inset <= block.y + CONTACT_REACH) {
        m_Hitbox.y = block.y - TILE + inset;
        m_YVelocity = 0;
        if (m_GravityMultiplier == 1) {
            m_IsGrounded = true;
        }
    } else if (m_YVelocity < 0 && m_PreviousPosition.y + inset >= blockBottom - CONTACT_REACH) {
        m_Hitbox.y = blockBottom - inset;
        m_YVelocity = 0;
        if (m_GravityMultiplier == -1) {
            m_IsGrounded = true;
        }
    } else {
        die();
    }
}

void Player::collideWithGround() {
    switch (m_Gamemode) {
    case Gamemode::CUBE:
        if (m_HasBounds) {
            if (m_GravityMultiplier == -1 && m_YVelocity <= 0 && m_Hitbox.y <= m_Bounds.first) {
                m_Hitbox.y = m_Bounds.first;
                m_IsGrounded = true;
                m_YVelocity = 0;
            }
            if (m_Hitbox.y + TILE > m_Bounds.second) {
                m_Hitbox.y = m_Bounds.second - TILE;
                if (m_YVelocity > 0) {
                    m_YVelocity = 0;
                }
            }
        } else if (m_GravityMultiplier == 1) {
            if (m_YVelocity >= 0 && m_Hitbox.y + TILE >= FLOOR_Y) {
                m_Hitbox.y = FLOOR_Y - TILE;
                m_IsGrounded = true;
                m_YVelocity = 0;
            }
        } else if (m_Hitbox.y + TILE > FLOOR_Y) {
            m_Hitbox.y = FLOOR_Y - TILE;
            if (m_YVelocity > 0) {
                m_YVelocity = 0;
            }
        }
        break;
    case Gamemode::SHIP:
        if (m_Hitbox.y < m_Bounds.first) {
            m_Hitbox.y = m_Bounds.first;
            m_YVelocity = 0;
        }
        if (m_Hitbox.y + TILE > m_Bounds.second) {
            m_Hitbox.y = m_Bounds.second - TILE;
            m_IsGrounded = true;
            m_YVelocity = 0;
        }
        break;
    case Gamemode::BALL:
    case Gamemode::UFO:
    case Gamemode::WAVE: {
        // Rolls, stands or slides on the floor and the ceiling. The wave's
        // small box (a third in from each side) is what touches them.
        const float inset = m_Gamemode == Gamemode::WAVE ? TILE / 3 : 0.0f;
        const float floorY = m_HasBounds ? m_Bounds.second : FLOOR_Y;
        if (m_Hitbox.y + TILE - inset >= floorY) {
            if (m_GravityMultiplier == 1 && m_YVelocity >= 0) {
                m_Hitbox.y = floorY - TILE + inset;
                m_YVelocity = 0;
                m_IsGrounded = true;
            } else if (m_Hitbox.y + TILE - inset > floorY) {
                m_Hitbox.y = floorY - TILE + inset;
                if (m_YVelocity > 0) {
                    m_YVelocity = 0;
                }
            }
        }
        if (m_HasBounds && m_Hitbox.y + inset <= m_Bounds.first) {
            if (m_GravityMultiplier == -1 && m_YVelocity <= 0) {
                m_Hitbox.y = m_Bounds.first - inset;
                m_YVelocity = 0;
                m_IsGrounded = true;
            } else if (m_Hitbox.y + inset < m_Bounds.first) {
                m_Hitbox.y = m_Bounds.first - inset;
                if (m_YVelocity < 0) {
                    m_YVelocity = 0;
                }
            }
        }
        break;
    }
    }
}

void Player::setBounds(const Object &portal) {
    static constexpr int BOUNDS_HEIGHT = (Config::HEIGHT - 10*Config::TILE_SIZE)/2;
    // why does gd do this lmao
    const float newCameraY = std::clamp(
        (std::round(portal.getPos().y/Config::TILE_SIZE)-3)*Config::TILE_SIZE - BOUNDS_HEIGHT,
        -10000.0f,
        static_cast<float>(-3*Config::TILE_SIZE + BOUNDS_HEIGHT)
    );
    m_Game->smoothCameraYScroll(newCameraY);
    m_Bounds.first = newCameraY + BOUNDS_HEIGHT;
    m_Bounds.second = m_Bounds.first + 10 * Config::TILE_SIZE;
    m_HasBounds = true;
}

void Player::activateTriggers(std::vector<Trigger> &triggers) {
    for (Trigger &trigger : triggers) {
        bool passedTrigger = m_Position.x > trigger.getPos().x + Config::TILE_SIZE/2;
        if (passedTrigger) {
            trigger.activate();
        }
    }
}

void Player::updateCubeRotation(float deltaTime) {
    m_Rotation += m_GravityMultiplier * m_RotationAdder * deltaTime;
    m_Rotation = std::fmod(m_Rotation, 360.0f);
    if (m_GravityMultiplier == 1) {
        if (!m_IsGrounded && m_Rotation > m_TargetRotation) {
            m_TargetRotation = std::trunc(m_Rotation / 90) * 90 + 90;
        } else if (m_Rotation > m_TargetRotation) {
            m_Rotation = m_TargetRotation;
        }
    } else {
        if (!m_IsGrounded && m_Rotation < m_TargetRotation) {
            m_TargetRotation = std::trunc(m_Rotation / 90) * 90 - 90;
        } else if (m_Rotation < m_TargetRotation) {
            m_Rotation = m_TargetRotation;
        }
    }
    m_TargetRotation = std::fmod(m_TargetRotation, 360.0f);
}

void Player::updateShipRotation(float deltaTime) {
    if (m_Gamemode == Gamemode::SHIP) {
        // thanks to https://github.com/Open-GD/OpenGD/blob/32b60243749c1619b5814e87c0ec2e4b36f019bd/Source/GameToolbox/math.cpp#L47
        if (std::pow(m_YVelocity, 2) + std::pow(m_XVelocity, 2) >= 1.2) {
            float target = std::atan2(m_YVelocity, m_XVelocity) * 57.2957795131f;
            // exponential interpolation
            m_Rotation += (target - m_Rotation) * (1.0f - std::pow(0.85f, deltaTime));
        }
    }
}

void Player::updateOtherRotation(float deltaTime) {
    switch (m_Gamemode) {
    case Gamemode::BALL:
        // rolls like a wheel: one turn per 120 pi pixels, backwards on the ceiling
        m_Rotation += m_GravityMultiplier * m_XVelocity * 0.955f * deltaTime;
        m_Rotation = std::fmod(m_Rotation, 360.0f);
        break;
    case Gamemode::UFO: {
        // tips a little toward where it is going
        const float target = std::clamp(m_YVelocity * 0.45f, -12.0f, 12.0f);
        m_Rotation += (target - m_Rotation) * (1.0f - std::pow(0.8f, deltaTime));
        break;
    }
    case Gamemode::WAVE: {
        // points along its line, flat while sliding
        const float target = std::atan2(m_YVelocity * 0.9f, m_XVelocity) * 57.2957795131f;
        m_Rotation += (target - m_Rotation) * (1.0f - std::pow(0.3f, deltaTime));
        break;
    }
    default:
        break;
    }
}

void Player::updateTrail() {
    if (m_Gamemode == Gamemode::WAVE) {
        m_Trail.push_back({ m_Position.x + TILE / 2, m_Position.y + TILE / 2 });
    }
    // about five tiles of line; after the wave it shrinks away behind the player
    const float keepFrom = m_Position.x + TILE / 2 - 5 * TILE;
    std::size_t drop = 0;
    while (drop < m_Trail.size() && (m_Trail[drop].x < keepFrom || m_Trail.size() - drop > 120)) {
        drop++;
    }
    m_Trail.erase(m_Trail.begin(), m_Trail.begin() + static_cast<std::ptrdiff_t>(drop));
}

void Player::renderTrail() const {
    if (m_Trail.size() < 2) {
        return;
    }
    const SDL_FPoint camera = m_Game->getCameraPosition();
    const SDL_Color skin = m_Game->getSkinColor(m_Game->getSelectedSkin());
    const std::size_t count = m_Trail.size();
    // a ribbon in the skin's colour with a white middle, thin and clear at the old end
    for (int pass = 0; pass < 2; pass++) {
        std::vector<SDL_Vertex> vertices;
        std::vector<int> indices;
        vertices.reserve(count * 2);
        for (std::size_t i = 0; i < count; i++) {
            const SDL_FPoint before = m_Trail[i == 0 ? 0 : i - 1];
            const SDL_FPoint after = m_Trail[i + 1 < count ? i + 1 : i];
            float dx = after.x - before.x;
            float dy = after.y - before.y;
            const float length = std::sqrt(dx * dx + dy * dy);
            if (length > 0.001f) {
                dx /= length;
                dy /= length;
            } else {
                dx = 1;
                dy = 0;
            }
            const float t = static_cast<float>(i) / static_cast<float>(count - 1);
            const float width = (pass == 0 ? 26.0f : 9.0f) * (0.25f + 0.75f * t);
            const Uint8 alpha = static_cast<Uint8>((pass == 0 ? 190.0f : 230.0f) * t);
            const SDL_Color color = pass == 0 ? SDL_Color { skin.r, skin.g, skin.b, alpha } : SDL_Color { 255, 255, 255, alpha };
            const float x = m_Trail[i].x - camera.x;
            const float y = m_Trail[i].y - camera.y;
            vertices.push_back({ { x - dy * width / 2, y + dx * width / 2 }, color, { 0, 0 } });
            vertices.push_back({ { x + dy * width / 2, y - dx * width / 2 }, color, { 0, 0 } });
            if (i > 0) {
                const int a = static_cast<int>(i * 2) - 2;
                indices.insert(indices.end(), { a, a + 1, a + 2, a + 1, a + 3, a + 2 });
            }
        }
        SDL_SetRenderDrawBlendMode(m_Renderer, SDL_BLENDMODE_BLEND);
        SDL_RenderGeometry(m_Renderer, nullptr, vertices.data(), static_cast<int>(vertices.size()), indices.data(), static_cast<int>(indices.size()));
    }
}

void Player::scrollCamera() {
    static constexpr int CAMERA_SCROLL = Config::TILE_SIZE * 6;
    static constexpr int CAMERA_UP_SCROLL = Config::HEIGHT / 4;
    static constexpr int CAMERA_DOWN_SCROLL = Config::HEIGHT - 4*Config::TILE_SIZE;

    const SDL_FPoint cameraPosition = m_Game->getCameraPosition();

    if (m_Platformer) {
        // keep the cube a little left of the middle, both ways
        const float target = m_Position.x - m_Game->getWidth() * 0.42f;
        m_Game->setCameraX(std::max(-static_cast<float>(TILE), target));
    } else if (m_Position.x - cameraPosition.x > CAMERA_SCROLL) {
        m_Game->setCameraX(m_Position.x - CAMERA_SCROLL);
    }

    // With a floor and a ceiling on screen the camera stays where setBounds put it.
    if (m_Gamemode != Gamemode::SHIP && !m_HasBounds) {
        if (m_Position.y - cameraPosition.y < CAMERA_UP_SCROLL) {
            float target = m_Position.y - CAMERA_UP_SCROLL;
            m_Game->smoothCameraYScroll(target);
        }
        if (m_Position.y - cameraPosition.y > CAMERA_DOWN_SCROLL) {
            float target = std::min(m_Position.y - CAMERA_DOWN_SCROLL, 0.0f);
            m_Game->smoothCameraYScroll(target);
        }
    }
}

void Player::render() const {
    for (const Checkpoint &checkpoint : m_Checkpoints) {
        const SDL_Rect rect = {
            static_cast<int>(checkpoint.position.x - m_Game->getCameraPosition().x + 10),
            static_cast<int>(checkpoint.position.y - m_Game->getCameraPosition().y + 10),
            100,
            100
        };
        SDL_RenderCopy(m_Renderer, m_CheckpointTexture, NULL, &rect);
    }

    SDL_Texture *skin = m_Game->getSkinTexture(m_Game->getSelectedSkin());
    if (m_IsDead) {
        renderDeath(skin);
        return;
    }
    renderTrail();
    if (m_Gamemode == Gamemode::CUBE) {
        renderCube(skin);
    } else {
        const SDL_FPoint camera = m_Game->getCameraPosition();
        renderBody(m_Gamemode, m_Game->getSelectedSkin(), m_Position.x - camera.x, m_Position.y - camera.y, m_Rotation, m_GravityMultiplier, 255);
    }
    if (m_Game->showHitboxes()) {
        // full box (spikes, landing) and inner box (block hits)
        const SDL_FPoint camera = m_Game->getCameraPosition();
        SDL_SetRenderDrawBlendMode(m_Renderer, SDL_BLENDMODE_BLEND);
        const SDL_FRect outer = { m_Hitbox.x - camera.x, m_Hitbox.y - camera.y, TILE, TILE };
        SDL_SetRenderDrawColor(m_Renderer, 255, 60, 60, 255);
        for (int i = 0; i < 3; i++) {
            const SDL_FRect edge = { outer.x + i, outer.y + i, outer.w - 2 * i, outer.h - 2 * i };
            SDL_RenderDrawRectF(m_Renderer, &edge);
        }
        const SDL_FRect inner = { outer.x + TILE / 3, outer.y + TILE / 3, TILE / 3, TILE / 3 };
        SDL_SetRenderDrawColor(m_Renderer, 60, 160, 255, 160);
        SDL_RenderFillRectF(m_Renderer, &inner);
    }
}

void Player::renderCube(SDL_Texture *skin) const {
    const float radians = m_Rotation * DEGREES_TO_RADIANS;
    const bool movingTowardLanding = m_IsGrounded || m_GravityMultiplier * m_YVelocity >= 0;
    const float landingVisualOffset = cubeVisualOffset(radians, m_GravityMultiplier, movingTowardLanding);
    const SDL_FRect dst = {
        m_Position.x - m_Game->getCameraPosition().x,
        m_Position.y - m_Game->getCameraPosition().y - landingVisualOffset,
        TILE,
        TILE
    };
    SDL_RenderCopyExF(m_Renderer, skin, NULL, &dst, m_Rotation, NULL, SDL_FLIP_NONE);
}

void Player::renderBody(Gamemode mode, int skinIndex, float x, float y, float rotation, int gravity, Uint8 alpha) const {
    SDL_Texture *skin = m_Game->getSkinTexture(skinIndex);
    SDL_SetTextureAlphaMod(skin, alpha);
    switch (mode) {
    case Gamemode::CUBE: {
        const SDL_FRect cube = { x, y, TILE, TILE };
        SDL_RenderCopyExF(m_Renderer, skin, NULL, &cube, rotation, NULL, (m_Platformer && m_FacingLeft && alpha == 255) ? SDL_FLIP_HORIZONTAL : SDL_FLIP_NONE);
        break;
    }
    case Gamemode::SHIP:
    case Gamemode::UFO: {
        // the small cube sits in the cockpit (ship) or the glass cup (UFO):
        // both pictures are 149 x 88 with the same seat
        SDL_Texture *body = mode == Gamemode::SHIP ? m_ShipTexture : m_UfoTexture;
        const float bodyWidth = static_cast<float>(m_ShipWidth);
        const float bodyHeight = static_cast<float>(m_ShipHeight);
        const float xDisplacement = std::trunc((bodyWidth - TILE) / 2);
        const SDL_FRect cube = { x + TILE * 6 / 25, gravity == 1 ? y + TILE / 20 : y + TILE * 2 / 5, TILE * 14 / 25, TILE * 14 / 25 };
        const SDL_FRect frame = { x - xDisplacement, gravity == 1 ? y + TILE - bodyHeight : y, bodyWidth, bodyHeight };
        const SDL_FPoint center = { frame.x + frame.w / 2 - cube.x, frame.y + frame.h / 2 - cube.y };
        const SDL_RendererFlip flip = gravity == 1 ? SDL_FLIP_NONE : SDL_FLIP_VERTICAL;
        SDL_SetTextureAlphaMod(body, alpha);
        SDL_RenderCopyExF(m_Renderer, skin, NULL, &cube, rotation, &center, flip);
        SDL_RenderCopyExF(m_Renderer, body, NULL, &frame, rotation, NULL, flip);
        SDL_SetTextureAlphaMod(body, 255);
        break;
    }
    case Gamemode::BALL: {
        // the cube looks out of the round window (64 x 64 at 28, 28) and both spin together
        const SDL_FRect face = { x + 28, y + 28, 64, 64 };
        const SDL_FRect shell = { x, y, TILE, TILE };
        SDL_SetTextureAlphaMod(m_BallTexture, alpha);
        SDL_RenderCopyExF(m_Renderer, skin, NULL, &face, rotation, NULL, SDL_FLIP_NONE);
        SDL_RenderCopyExF(m_Renderer, m_BallTexture, NULL, &shell, rotation, NULL, SDL_FLIP_NONE);
        SDL_SetTextureAlphaMod(m_BallTexture, 255);
        break;
    }
    case Gamemode::WAVE: {
        // the dart takes a light shade of the skin's colour
        const SDL_Color color = m_Game->getSkinColor(skinIndex);
        const auto light = [](Uint8 channel) { return static_cast<Uint8>(255 - (255 - channel) * 0.55f); };
        const SDL_FRect dart = { x + 15, y + 15, 90, 90 };
        SDL_SetTextureColorMod(m_WaveTexture, light(color.r), light(color.g), light(color.b));
        SDL_SetTextureAlphaMod(m_WaveTexture, alpha);
        SDL_RenderCopyExF(m_Renderer, m_WaveTexture, NULL, &dart, rotation, NULL, SDL_FLIP_NONE);
        SDL_SetTextureAlphaMod(m_WaveTexture, 255);
        break;
    }
    }
    SDL_SetTextureAlphaMod(skin, 255);
}

float Player::debrisFloor(float x, float fromY) const {
    float floor = hasBounds() ? m_Bounds.second : FLOOR_Y;
    const LevelManager &level = PlayingState::get().getLevel();
    const std::vector<const Object *> &collidables = level.getCollidables();
    for (std::size_t i = level.firstCollidableFrom(x - 2 * TILE); i < collidables.size(); i++) {
        const SDL_FRect box = collidables[i]->getHitbox().value();
        if (box.x > x) {
            break;
        }
        if (collidables[i]->getType() == ObjectType::BLOCK && x < box.x + box.w && box.y >= fromY && box.y < floor) {
            floor = box.y;
        }
    }
    return floor;
}

void Player::spawnDebris() {
    m_Debris.clear();
    m_DebrisPiles.clear();
    unsigned int random = static_cast<unsigned int>(std::abs(m_DeathPosition.x)) * 2654435761u + 7u;
    const auto next = [&random]() {
        random = random * 1664525u + 1013904223u;
        return static_cast<float>((random >> 8) & 0xFFFF) / 65535.0f;
    };
    for (int i = 0; i < 28; i++) {
        Debris piece;
        piece.x = m_DeathPosition.x + TILE * (0.2f + 0.6f * next());
        piece.y = m_DeathPosition.y + TILE * (0.2f + 0.6f * next());
        piece.xVelocity = -7.0f + 16.0f * next();
        piece.yVelocity = -24.0f + 16.0f * next();
        piece.rotation = 360.0f * next();
        piece.spin = -14.0f + 28.0f * next();
        piece.size = 16.0f + 16.0f * next();
        piece.shape = static_cast<int>(next() * 2.999f);
        piece.resting = false;
        m_Debris.push_back(piece);
    }
}

void Player::updateDebris(float deltaTime) {
    for (Debris &piece : m_Debris) {
        if (piece.resting) {
            continue;
        }
        piece.yVelocity += 1.4f * deltaTime;
        piece.xVelocity *= std::pow(0.985f, deltaTime);
        piece.x += piece.xVelocity * deltaTime;
        piece.y += piece.yVelocity * deltaTime;
        piece.rotation += piece.spin * deltaTime;
        if (piece.yVelocity <= 0) {
            continue;
        }
        // land on the floor, a block, or the powder already lying there
        const int column = static_cast<int>(std::floor(piece.x / 18.0f));
        float pile = 0;
        for (const auto &[at, height] : m_DebrisPiles) {
            if (std::abs(at - column) <= 1) {
                pile = std::max(pile, height);
            }
        }
        const float surface = debrisFloor(piece.x, piece.y - piece.yVelocity * deltaTime) - pile;
        if (piece.y + piece.size / 2 < surface) {
            continue;
        }
        piece.y = surface - piece.size / 2;
        if (piece.yVelocity > 9.0f) {
            piece.yVelocity *= -0.3f;
            piece.xVelocity *= 0.5f;
            continue;
        }
        piece.resting = true;
        piece.rotation = std::round(piece.rotation / 90.0f) * 90.0f;
        bool added = false;
        for (auto &[at, height] : m_DebrisPiles) {
            if (at == column) {
                height = std::max(height, pile) + piece.size * 0.7f;
                added = true;
            }
        }
        if (!added) {
            m_DebrisPiles.push_back({ column, pile + piece.size * 0.7f });
        }
    }
}

void Player::renderDeath(SDL_Texture *skin) const {
    (void)skin;
    const SDL_FPoint camera = m_Game->getCameraPosition();
    const float elapsed = DEATH_FRAMES - m_DeadTimer;
    // a quick white ring, then the powder
    if (elapsed < 14.0f) {
        const float progress = elapsed / 14.0f;
        const float centerX = m_DeathPosition.x + TILE / 2 - camera.x;
        const float centerY = m_DeathPosition.y + TILE / 2 - camera.y;
        SDL_SetRenderDrawBlendMode(m_Renderer, SDL_BLENDMODE_BLEND);
        SDL_SetRenderDrawColor(m_Renderer, 255, 255, 255, static_cast<Uint8>(220 * (1.0f - progress)));
        const float ring = 30.0f + 150.0f * progress;
        for (int i = 0; i < 24; i++) {
            const float angle = i * 15.0f * DEGREES_TO_RADIANS;
            const SDL_FRect dot = { centerX + std::cos(angle) * ring - 5, centerY + std::sin(angle) * ring - 5, 10, 10 };
            SDL_RenderFillRectF(m_Renderer, &dot);
        }
    }
    const SDL_Color color = m_Game->getSkinColor(m_Game->getSelectedSkin());
    SDL_SetTextureColorMod(m_DebrisTexture, color.r, color.g, color.b);
    for (const Debris &piece : m_Debris) {
        const SDL_Rect source = { piece.shape * 32, 0, 32, 32 };
        const SDL_FRect dst = { piece.x - piece.size / 2 - camera.x, piece.y - piece.size / 2 - camera.y, piece.size, piece.size };
        SDL_RenderCopyExF(m_Renderer, m_DebrisTexture, &source, &dst, piece.rotation, NULL, SDL_FLIP_NONE);
    }
}

void Player::die() {
    // creator mode: nothing hurts (the level checker always plays for real)
    if (!m_SimInput && m_Game->isCreatorMode()) {
        return;
    }
    m_IsDead = true;
    m_DeadTimer = DEATH_FRAMES;
    m_DeathPosition = { m_Hitbox.x, m_Hitbox.y };
    m_Position = m_PreviousPosition;
    m_Hitbox.x = m_PreviousPosition.x;
    m_Hitbox.y = m_PreviousPosition.y;
    m_YVelocity = 0;
    if (m_SimInput) {
        return;
    }
    spawnDebris();
    if (!PlayingState::get().isInPractice()) {
        Mix_HaltMusic();
    }
    Mix_PlayChannel(-1, m_DeathSound, 0);
}

bool Player::isDead() const {
    return m_IsDead;
}

Gamemode Player::getGamemode() const {
    return m_Gamemode;
}
