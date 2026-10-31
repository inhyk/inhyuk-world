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
    m_PressedOrbs.clear();
    m_Checkpoints.clear();
    m_Coins = 0;
    for (Trigger &trigger : PlayingState::get().getTriggers()) {
        trigger.reset();
    }
}

Player::~Player() {
    SDL_DestroyTexture(m_ShipTexture);
    SDL_DestroyTexture(m_CheckpointTexture);
    Mix_FreeChunk(m_DeathSound);
    Mix_FreeChunk(m_CoinSound);
}

void Player::update(float deltaTime) {
    m_SimInput = false;
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

void Player::simUpdate(bool held, float deltaTime) {
    m_SimInput = true;
    const bool mouseClicked = !m_IsMouseHeld && held;
    const bool mouseReleased = m_IsMouseHeld && !held;
    m_IsMouseHeld = held;
    step(deltaTime, mouseClicked, mouseReleased);
}

void Player::step(float deltaTime, bool mouseClicked, bool mouseReleased) {
    if (m_IsDead) {
        m_DeadTimer -= deltaTime;
        if (m_DeadTimer < 0) {
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
        updateCubeRotation(deltaTime);
        break;
    case Gamemode::SHIP:
        updateShipRotation(deltaTime);
        break;
    }

    scrollCamera();

    if (m_Position.y < PlayingState::get().getMinY()) {
        die();
    }
    if (m_IsGrounded) {
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
    }
    m_Hitbox.x += m_XVelocity * deltaTime;
    m_Hitbox.y += m_YVelocity * deltaTime * 0.9f; // why the fuck does gd multiply by 0.9?
}

SDL_FRect Player::innerHitbox() const {
    return { m_Hitbox.x + TILE / 3, m_Hitbox.y + TILE / 3, TILE / 3, TILE / 3 };
}

void Player::handleCollisions() {
    if (m_Gamemode == Gamemode::CUBE) {
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
        if (object.getType() == ObjectType::BLOCK && m_Gamemode == Gamemode::CUBE) {
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
    switch (object.getType()) {
    case ObjectType::HAZARD:
        if (overlaps(m_Hitbox, hitbox)) {
            die();
        }
        break;
    case ObjectType::BLOCK:
        if (m_Gamemode == Gamemode::CUBE) {
            collideCubeWithBlock(hitbox);
        } else {
            collideShipWithBlock(hitbox);
        }
        break;
    case ObjectType::PAD:
        m_YVelocity = m_PadStrength * m_GravityMultiplier;
        // A pad wins over the floor touched in the same frame, otherwise a held
        // jump would replace the pad's launch on the next frame.
        m_IsGrounded = false;
        break;
    case ObjectType::ORB: {
        const bool orbHasNotBeenPressed = m_PressedOrbs.count(&object) == 0;
        if (m_HasBufferedOrb && orbHasNotBeenPressed) {
            m_YVelocity = m_JumpStrength * m_GravityMultiplier;
            m_IsGrounded = false;
            m_PressedOrbs.insert(&object);
        }
        break;
    }
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
        m_GravityMultiplier = -1;
        m_IsGrounded = false;
        // An upside-down cube gets a ceiling to run on, placed like a ship's.
        if (m_Gamemode == Gamemode::CUBE && !m_HasBounds) {
            setBounds(object);
        }
        break;
    case ObjectType::NORMAL_PORTAL:
        if (m_GravityMultiplier == 1) {
            break;
        }
        m_YVelocity /= 2;
        m_GravityMultiplier = 1;
        m_IsGrounded = false;
        if (m_Gamemode == Gamemode::CUBE) {
            m_HasBounds = false;
        }
        break;
    case ObjectType::SHIP_PORTAL:
        if (m_Gamemode != Gamemode::SHIP) {
            m_YVelocity /= 2;
            m_Rotation = 0;
        }
        m_Gamemode = Gamemode::SHIP;
        setBounds(object);
        break;
    case ObjectType::CUBE_PORTAL:
        if (m_Gamemode != Gamemode::CUBE) {
            m_YVelocity /= 2;
            m_Gamemode = Gamemode::CUBE;
            m_HasBounds = m_GravityMultiplier == -1;
        }
        break;
    default:
        break;
    }
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

void Player::collideShipWithBlock(const SDL_FRect &block) {
    if (overlaps(innerHitbox(), block)) {
        die();
        return;
    }
    const float blockBottom = block.y + block.h;
    if (m_YVelocity > 0 && m_PreviousPosition.y + TILE <= block.y + CONTACT_REACH && m_Hitbox.y + TILE >= block.y) {
        m_Hitbox.y = block.y - TILE;
        m_YVelocity = 0;
    } else if (m_YVelocity < 0 && m_PreviousPosition.y >= blockBottom - CONTACT_REACH && m_Hitbox.y <= blockBottom) {
        m_Hitbox.y = blockBottom;
        m_YVelocity = 0;
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

void Player::scrollCamera() {
    static constexpr int CAMERA_SCROLL = Config::TILE_SIZE * 6;
    static constexpr int CAMERA_UP_SCROLL = Config::HEIGHT / 4;
    static constexpr int CAMERA_DOWN_SCROLL = Config::HEIGHT - 4*Config::TILE_SIZE;

    const SDL_FPoint cameraPosition = m_Game->getCameraPosition();

    if (m_Position.x - cameraPosition.x > CAMERA_SCROLL) {
        m_Game->setCameraX(m_Position.x - CAMERA_SCROLL);
    }

    // With a floor and a ceiling on screen the camera stays where setBounds put it.
    if (m_Gamemode == Gamemode::CUBE && !m_HasBounds) {
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
    switch (m_Gamemode) {
    case Gamemode::CUBE:
        renderCube(skin);
        break;
    case Gamemode::SHIP:
        renderShip(skin);
        break;
    }
    if (m_Game->isCreatorMode()) {
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

void Player::renderShip(SDL_Texture *skin) const {
    const int xDisplacement = (m_ShipWidth - m_Hitbox.w)/2;
    SDL_FPoint cameraPosition = m_Game->getCameraPosition();
    float cubeX = m_Position.x - cameraPosition.x + m_Hitbox.w*6/25;
    float cubeY = m_Position.y - cameraPosition.y + m_Hitbox.w/20;
    float shipX = m_Position.x - cameraPosition.x - xDisplacement;
    float shipY = m_Position.y - cameraPosition.y + m_Hitbox.w - m_ShipHeight;
    if (m_GravityMultiplier == -1) {
        cubeY = m_Position.y - cameraPosition.y + m_Hitbox.w*2/5;
        shipY = m_Position.y - cameraPosition.y;
    }
    const SDL_FRect cubeDST = {
        cubeX,
        cubeY,
        static_cast<float>(m_Hitbox.w*14/25),
        static_cast<float>(m_Hitbox.w*14/25)
    };
    const SDL_FRect shipDST = {
        shipX,
        shipY,
        static_cast<float>(m_ShipWidth),
        static_cast<float>(m_ShipHeight)
    };
    const SDL_FPoint cubeCenter = {shipDST.x + shipDST.w / 2 - cubeDST.x, shipDST.y + shipDST.h / 2 - cubeDST.y};
    const SDL_RendererFlip flip = m_GravityMultiplier == 1 ? SDL_FLIP_NONE : SDL_FLIP_VERTICAL;
    SDL_RenderCopyExF(m_Renderer, skin, NULL, &cubeDST, m_Rotation, &cubeCenter, flip);
    SDL_RenderCopyExF(m_Renderer, m_ShipTexture, NULL, &shipDST, m_Rotation, NULL, flip);
}

void Player::renderDeath(SDL_Texture *skin) const {
    // Eight small copies of the cube fly apart and fade out.
    constexpr float DURATION = 40.0f;
    const float elapsed = 90.0f - m_DeadTimer;
    if (elapsed > DURATION) {
        return;
    }
    const float progress = elapsed / DURATION;
    const SDL_FPoint camera = m_Game->getCameraPosition();
    const float centerX = m_DeathPosition.x + TILE / 2 - camera.x;
    const float centerY = m_DeathPosition.y + TILE / 2 - camera.y;
    const float size = TILE * 0.32f * (1.0f - 0.5f * progress);
    const Uint8 alpha = static_cast<Uint8>(255 * (1.0f - progress));
    SDL_SetTextureAlphaMod(skin, alpha);
    for (int i = 0; i < 8; i++) {
        const float angle = (i * 45.0f + 22.5f) * DEGREES_TO_RADIANS;
        const float distance = 30.0f + 260.0f * std::sqrt(progress);
        const SDL_FRect dst = {
            centerX + std::cos(angle) * distance - size / 2,
            centerY + std::sin(angle) * distance - size / 2,
            size,
            size
        };
        SDL_RenderCopyExF(m_Renderer, skin, NULL, &dst, progress * 540.0f + i * 40.0f, NULL, SDL_FLIP_NONE);
    }
    SDL_SetTextureAlphaMod(skin, 255);
    // a quick white ring
    SDL_SetRenderDrawBlendMode(m_Renderer, SDL_BLENDMODE_BLEND);
    SDL_SetRenderDrawColor(m_Renderer, 255, 255, 255, static_cast<Uint8>(200 * (1.0f - progress)));
    const float ring = 40.0f + 220.0f * progress;
    for (int i = 0; i < 24; i++) {
        const float angle = i * 15.0f * DEGREES_TO_RADIANS;
        const SDL_FRect dot = { centerX + std::cos(angle) * ring - 5, centerY + std::sin(angle) * ring - 5, 10, 10 };
        SDL_RenderFillRectF(m_Renderer, &dot);
    }
}

void Player::die() {
    // creator mode: nothing hurts (the level checker always plays for real)
    if (!m_SimInput && m_Game->isCreatorMode()) {
        return;
    }
    m_IsDead = true;
    m_DeadTimer = 90;
    m_DeathPosition = { m_Hitbox.x, m_Hitbox.y };
    m_Position = m_PreviousPosition;
    m_Hitbox.x = m_PreviousPosition.x;
    m_Hitbox.y = m_PreviousPosition.y;
    m_YVelocity = 0;
    if (m_SimInput) {
        return;
    }
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
