#pragma once
#include <SDL.h>
#include <optional>

class Game;

enum class ObjectType {
    BLOCK,
    HAZARD,
    ORB,
    PAD,
    SHIP_PORTAL,
    CUBE_PORTAL,
    UPSIDE_DOWN_PORTAL,
    NORMAL_PORTAL,
    DECO,
    BG_TRIGGER,
    G_TRIGGER,
    COIN
};

class Object {
public:
    Object(Game *game, ObjectType type, int rotation, SDL_FPoint pos, std::optional<SDL_FRect> hitbox, bool xFlip, bool yFlip, SDL_Texture *objectTexture);
    std::optional<SDL_FRect> getHitbox() const;
    SDL_FPoint getPos() const;
    int getWidth() const;
    int getHeight() const;
    ObjectType getType() const;
    void render() const;
    // Light poles (ids 15-17) flash a little star on their ball now and then.
    inline void setSparkle(bool sparkle) { m_Sparkle = sparkle; }
    // Coins are numbered 0-2 from left to right; other objects have -1.
    inline void setCoinIndex(int index) { m_CoinIndex = index; }
    inline int getCoinIndex() const { return m_CoinIndex; }

protected:
    Game *m_Game;
    SDL_Renderer *m_Renderer;
    ObjectType m_Type;
    int m_Width;
    int m_Height;
    int m_Rotation;
    SDL_FPoint m_Position;
    std::optional<SDL_FRect> m_Hitbox;
    bool m_FlipX;
    bool m_FlipY;
    SDL_Texture *m_ObjectTexture;
    bool m_Sparkle = false;
    int m_CoinIndex = -1;

    void renderSparkle(int x, int y) const;
};

