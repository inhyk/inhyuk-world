#pragma once
#include <SDL.h>
#include <SDL_mixer.h>
#include <vector>
#include <array>
#include <set>
#include <utility>

enum class Gamemode {
    CUBE,
    SHIP
};

struct Checkpoint {
    SDL_FPoint position;
    SDL_FPoint cameraPosition;
    float yVelocity;
    float rotation;
    float targetRotation;
    int gravityMultiplier;
    Gamemode gamemode;
    bool hasBounds;
    std::pair<float, float> bounds;
    std::array<float, 3> backgroundColor;
    std::array<float, 3> groundColor;
    SDL_Color backgroundTargetColor;
    SDL_Color groundTargetColor;
    float backgroundFadeTime = 0;
    float groundFadeTime = 0;
};

// Everything the physics reads between frames. The level checker saves and
// restores this to try different inputs from the same moment.
struct PlayerSimState {
    SDL_FPoint position;
    SDL_FPoint previousPosition;
    SDL_FRect hitbox;
    float yVelocity;
    float rotation;
    float targetRotation;
    bool isGrounded;
    bool isMouseHeld;
    bool isDead;
    bool hasBufferedOrb;
    bool hasBounds;
    int gravityMultiplier;
    Gamemode gamemode;
    std::pair<float, float> bounds;
    std::vector<int> pressedOrbs;
};

class Game;
class Object;
class Trigger;

class Player {
public:
    static constexpr float DEFAULT_X_VELOCITY = 20.772f;

    Player() = default;
    ~Player();
    Player(const Player &) = delete;
    Player &operator=(const Player &) = delete;
    void init(Game *game);
    void reset();
    void update(float deltaTime);
    void simUpdate(bool held, float deltaTime);
    PlayerSimState saveSimState() const;
    void restoreSimState(const PlayerSimState &state);
    inline void moveX(float dist) { m_Position.x += dist; }
    inline void moveY(float dist) { m_Position.y += dist; }
    void placeCheckpoint();
    void removeCheckpoint();
    void die();
    bool isDead() const;
    void render() const;
    Gamemode getGamemode() const;
    inline int getGravityMultiplier() const { return m_GravityMultiplier; }
    inline SDL_FPoint getPosition() const { return m_Position; }
    inline float getYVelocity() const { return m_YVelocity; }
    inline bool isGrounded() const { return m_IsGrounded; }
    // Ship sections and upside-down cube sections have a visible floor and ceiling.
    inline bool hasBounds() const { return m_Gamemode == Gamemode::SHIP || m_HasBounds; }
    inline std::pair<float, float> getBounds() const { return m_Bounds; }

private:
    Game *m_Game;
    SDL_Renderer *m_Renderer;
    SDL_Texture *m_ShipTexture;
    int m_ShipWidth;
    int m_ShipHeight;
    SDL_Texture *m_CheckpointTexture;
    Mix_Chunk *m_DeathSound;
    SDL_FPoint m_Position;
    SDL_FPoint m_PreviousPosition;
    float m_XVelocity = DEFAULT_X_VELOCITY;
    float m_YVelocity;
    float m_JumpStrength = -44.72f;
    float m_PadStrength = -64;
    float m_Gravity = 3.456f;
    float m_RotationAdder = 6.92308f;
    float m_Rotation;
    float m_TargetRotation;
    // Full square used for spikes, landing and the floor. Blocks only kill
    // when the smaller inner square (the middle third) touches them.
    SDL_FRect m_Hitbox;
    // the size of the objects vector won't change so it should be safe to store pointers to the objects
    std::set<const Object *> m_PressedOrbs;
    std::vector<Checkpoint> m_Checkpoints;
    bool m_IsGrounded;
    bool m_IsMouseHeld;
    bool m_IsDead;
    bool m_HasBufferedOrb;
    bool m_HasBounds = false;
    bool m_SimInput = false;
    bool m_SimHeld = false;
    float m_DeadTimer;
    SDL_FPoint m_DeathPosition = { 0, 0 };
    int m_GravityMultiplier;
    Gamemode m_Gamemode;
    std::pair<float, float> m_Bounds = { 0, 0 };

    void respawn();
    void step(float deltaTime, bool mouseClicked, bool mouseReleased);
    void updatePhysics(float deltaTime, bool mouseClicked, bool mouseReleased);
    void handleCollisions();
    void collideWithGround();
    void collideWithObject(const Object &object);
    void collideCubeWithBlock(const SDL_FRect &block);
    void collideShipWithBlock(const SDL_FRect &block);
    void setBounds(const Object &portal);
    SDL_FRect innerHitbox() const;
    void activateTriggers(std::vector<Trigger> &triggers);
    void updateCubeRotation(float deltaTime);
    void updateShipRotation(float deltaTime);
    void scrollCamera();
    void renderCube(SDL_Texture *skin) const;
    void renderShip(SDL_Texture *skin) const;
    void renderDeath(SDL_Texture *skin) const;
};
