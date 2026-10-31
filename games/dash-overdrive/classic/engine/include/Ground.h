#pragma once
#include <SDL.h>
#include <cstdint>
#include <array>
#include "Config.h"

class Game;

class Ground {
public:
    static constexpr int DEFAULT_HEIGHT = 3 * Config::TILE_SIZE;
    Ground() = default;
    void init(Game *game, uint8_t r, uint8_t g, uint8_t b);
    void destroy();
    void fade(uint8_t r, uint8_t g, uint8_t b, float time);
    void setPosition(SDL_FPoint pos);
    SDL_FPoint getPosition() const;
    void resetPosition();
    void update(float delta);
    void move(float distance, float delta);
    void render() const;
    // Ship and upside-down sections draw a floor and a ceiling at these world
    // heights, the same ones the player collides with.
    void setBounds(bool active, float top, float bottom);
    std::array<float, 3> getColor() const;
    void setColor(std::array<float, 3> color);
    SDL_Color getTargetColor() const;
    void setTargetColor(SDL_Color color);
    float getFadeTime() const;
    void setFadeTime(float fadeTime);

private:
    Game *m_Game;
    int m_GroundSize;
    int m_SquareCount;
    float m_Red;
    float m_Green;
    float m_Blue;
    uint8_t m_TargetRed;
    uint8_t m_TargetGreen;
    uint8_t m_TargetBlue;
    SDL_Texture *m_GroundTexture;
    SDL_Texture *m_LineTexture;
    SDL_FPoint m_Position;
    SDL_Renderer *m_Renderer;
    bool m_IsFading;
    bool m_HasBounds = false;
    float m_BoundsTop = 0;
    float m_BoundsBottom = 0;
    float m_FadeTime;

    void renderStrip(float surfaceY, bool ceiling) const;
};
