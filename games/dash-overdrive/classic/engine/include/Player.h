#pragma once
#include <SDL.h>
#include <SDL_mixer.h>
#include <vector>
#include <array>
#include <set>
#include <utility>

// The numbers are sent to friends in an online race (online.mjs "m").
enum class Gamemode {
    CUBE,
    SHIP,
    BALL,
    UFO,
    WAVE
};

// Speed gates: 1 arrow slow, 2 normal, 3 fast, 4 very fast.
constexpr int SPEED_COUNT = 4;
constexpr int NORMAL_SPEED = 1;
constexpr float SPEED_MULTIPLIERS[SPEED_COUNT] = { 0.8f, 1.0f, 1.25f, 1.5f };

struct Checkpoint {
    SDL_FPoint position;
    SDL_FPoint cameraPosition;
    float yVelocity;
    float rotation;
    float targetRotation;
    int gravityMultiplier;
    Gamemode gamemode;
    int speed;
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
    int speed;
    std::pair<float, float> bounds;
    std::vector<int> pressedOrbs;
    int coins;
};

class Game;
class Object;
class Trigger;

class Player {
public:
    static constexpr float DEFAULT_X_VELOCITY = 20.772f;
    // frames from death to respawn: the powder lands and piles up first
    static constexpr float DEATH_FRAMES = 105.0f;

    Player() = default;
    ~Player();
    Player(const Player &) = delete;
    Player &operator=(const Player &) = delete;
    void init(Game *game);
    void reset();
    void update(float deltaTime);
    void simUpdate(bool held, float deltaTime);
    // tower floors: buttons 1 jump, 2 left, 4 right
    void simUpdateButtons(int buttons, float deltaTime);
    // Tower floors walk: no running on its own, left and right as the player
    // presses, blocks are walls and ceilings instead of deadly sides.
    inline void setPlatformer(bool on) { m_Platformer = on; }
    inline bool isPlatformer() const { return m_Platformer; }
    // the designer asked for faster walking ("더 빨리 걷게 해줘"): as fast as running
    static constexpr float PLATFORM_SPEED = DEFAULT_X_VELOCITY;
    PlayerSimState saveSimState() const;
    void restoreSimState(const PlayerSimState &state);
    inline void moveX(float dist) { m_Position.x += dist; }
    inline void moveY(float dist) { m_Position.y += dist; }
    void placeCheckpoint();
    void removeCheckpoint();
    void die();
    bool isDead() const;
    void render() const;
    // Draws a body for the given mode with its top-left corner at (x, y) on
    // screen; friends' ghosts in an online race use it too.
    void renderBody(Gamemode mode, int skin, float x, float y, float rotation, int gravity, Uint8 alpha) const;
    Gamemode getGamemode() const;
    inline int getSpeed() const { return m_Speed; }
    inline float getSpeedMultiplier() const { return SPEED_MULTIPLIERS[m_Speed]; }
    inline int getGravityMultiplier() const { return m_GravityMultiplier; }
    inline SDL_FPoint getPosition() const { return m_Position; }
    inline float getYVelocity() const { return m_YVelocity; }
    inline float getRotation() const { return m_Rotation; }
    inline bool isGrounded() const { return m_IsGrounded; }
    // Ship, ball, UFO and wave sections and upside-down cube sections have a
    // visible floor and ceiling.
    inline bool hasBounds() const { return m_Gamemode == Gamemode::SHIP || m_HasBounds; }
    inline std::pair<float, float> getBounds() const { return m_Bounds; }
    inline bool hasCoin(int index) const { return (m_Coins >> index) & 1; }
    inline int getCoins() const { return m_Coins; }

private:
    Game *m_Game;
    SDL_Renderer *m_Renderer;
    SDL_Texture *m_ShipTexture;
    int m_ShipWidth;
    int m_ShipHeight;
    SDL_Texture *m_BallTexture;
    SDL_Texture *m_UfoTexture;
    SDL_Texture *m_WaveTexture;
    SDL_Texture *m_CheckpointTexture;
    Mix_Chunk *m_DeathSound;
    Mix_Chunk *m_CoinSound;
    // coins picked up in this run, one bit per coin
    int m_Coins = 0;
    SDL_FPoint m_Position;
    SDL_FPoint m_PreviousPosition;
    float m_XVelocity = DEFAULT_X_VELOCITY;
    int m_Speed = NORMAL_SPEED;
    float m_YVelocity;
    float m_JumpStrength = -44.72f;
    float m_PadStrength = -64;
    float m_Gravity = 3.456f;
    // Our own numbers for the other modes, orbs and pads (60 fps frames).
    static constexpr float PINK_ORB_JUMP = -32.0f;
    static constexpr float PINK_PAD_JUMP = -42.0f;
    static constexpr float BLUE_ORB_PUSH = 12.0f;
    static constexpr float BLUE_PAD_PUSH = 16.0f;
    static constexpr float BALL_GRAVITY = 2.2f;
    static constexpr float BALL_FLIP_SPEED = 12.0f;
    static constexpr float BALL_MAX_SPEED = 44.0f;
    static constexpr float UFO_GRAVITY = 2.3f;
    static constexpr float UFO_HOP = -30.0f;
    static constexpr float UFO_MAX_RISE = 60.0f;
    static constexpr float UFO_MAX_FALL = 30.0f;
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
    bool m_Platformer = false;
    int m_WalkDirection = 0;  // -1 left, 0 still, 1 right
    bool m_FacingLeft = false;
    int m_SimButtons = 0;
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
    void collidePlatformerWithBlock(const SDL_FRect &block);
    void collideShipWithBlock(const SDL_FRect &block);
    void collideWaveWithBlock(const SDL_FRect &block);
    void setBounds(const Object &portal);
    void setGravity(int gravity, const Object &object);
    void setSpeed(int speed);
    SDL_FRect innerHitbox() const;
    void activateTriggers(std::vector<Trigger> &triggers);
    void updateCubeRotation(float deltaTime);
    void updateShipRotation(float deltaTime);
    void updateOtherRotation(float deltaTime);
    void scrollCamera();
    void renderCube(SDL_Texture *skin) const;
    void renderDeath(SDL_Texture *skin) const;
    // The wave leaves a short fading line behind it (world positions).
    std::vector<SDL_FPoint> m_Trail;
    void updateTrail();
    void renderTrail() const;
    // Death powder (the designer's sketch: it falls and piles up after a second):
    // little shapes in the skin's colour that drop onto the floor or the blocks.
    struct Debris {
        float x;
        float y;
        float xVelocity;
        float yVelocity;
        float rotation;
        float spin;
        float size;
        int shape;
        bool resting;
    };
    std::vector<Debris> m_Debris;
    std::vector<std::pair<int, float>> m_DebrisPiles;
    SDL_Texture *m_DebrisTexture;
    void spawnDebris();
    void updateDebris(float deltaTime);
    float debrisFloor(float x, float fromY) const;
};
