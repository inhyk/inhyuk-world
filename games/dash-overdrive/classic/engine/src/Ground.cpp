#include "Ground.h"
#include "Game.h"
#include <iostream>
#include <SDL_image.h>

void Ground::init(Game *game, uint8_t r, uint8_t g, uint8_t b) {
    m_Game = game;
    m_Red = r;
    m_Green = g;
    m_Blue = b;
    m_Renderer = m_Game->getRenderer();
    m_GroundTexture = IMG_LoadTexture(m_Renderer, "res/gfx/ground.png");
    if (m_GroundTexture == nullptr) {
        std::cerr << "Failed to load ground.png! " << SDL_GetError() << std::endl;
    }
    m_LineTexture = IMG_LoadTexture(m_Renderer, "res/gfx/groundLine.png");
    if (m_LineTexture == nullptr) {
        std::cerr << "Failed to load groundLine.png! " << SDL_GetError() << std::endl;
    }
    SDL_SetTextureColorMod(m_GroundTexture, r, g, b);
    SDL_QueryTexture(m_GroundTexture, NULL, NULL, &m_GroundSize, NULL);
    m_SquareCount = m_Game->getWidth() / m_GroundSize + 2;
    m_Position = {0, static_cast<float>(Config::HEIGHT - DEFAULT_HEIGHT)};
    m_IsFading = false;
    m_FadeTime = 0;
}

void Ground::fade(uint8_t r, uint8_t g, uint8_t b, float time) {
    m_TargetRed = r;
    m_TargetGreen = g;
    m_TargetBlue = b;
    m_FadeTime = time * 60;
    m_IsFading = true;
}

void Ground::destroy() {
    SDL_DestroyTexture(m_GroundTexture);
    SDL_DestroyTexture(m_LineTexture);
}

void Ground::setPosition(SDL_FPoint pos) {
    m_Position = pos;
}

SDL_FPoint Ground::getPosition() const {
    return m_Position;
}

void Ground::move(float distance, float delta) {
    m_Position.x += distance * delta;
}

void Ground::resetPosition() {
    m_Position.x = 0;
}

void Ground::setBounds(bool active, float top, float bottom) {
    m_HasBounds = active;
    m_BoundsTop = top;
    m_BoundsBottom = bottom;
}

void Ground::update(float delta) {
    if (m_Position.x < -m_GroundSize) {
        m_Position.x += m_GroundSize;
    }
    if (m_IsFading) {
        m_FadeTime -= delta;
        if (m_FadeTime <= 0) {
            m_Red = m_TargetRed;
            m_Green = m_TargetGreen;
            m_Blue = m_TargetBlue;
            m_FadeTime = 0;
            m_IsFading = false;
        } else {
            m_Red += delta * (m_TargetRed - m_Red) / m_FadeTime;
            m_Green += delta * (m_TargetGreen - m_Green) / m_FadeTime;
            m_Blue += delta * (m_TargetBlue - m_Blue) / m_FadeTime;
        }
        SDL_SetTextureColorMod(m_GroundTexture, static_cast<uint8_t>(m_Red), static_cast<uint8_t>(m_Green), static_cast<uint8_t>(m_Blue));
    }
}

void Ground::renderStrip(float surfaceY, bool ceiling) const {
    const SDL_FPoint cameraPosition = m_Game->getCameraPosition();
    const float screenY = surfaceY - cameraPosition.y;
    for (int i = 0; i < m_SquareCount; i++) {
        SDL_FRect dst = {
            m_Position.x + i * m_GroundSize - cameraPosition.x,
            ceiling ? screenY - m_GroundSize : screenY,
            static_cast<float>(m_GroundSize),
            static_cast<float>(m_GroundSize)
        };
        while (dst.x + m_GroundSize < 0) {
            dst.x += m_SquareCount * m_GroundSize;
        }
        SDL_RenderCopyExF(m_Renderer, m_GroundTexture, NULL, &dst, 0.0, NULL, ceiling ? SDL_FLIP_VERTICAL : SDL_FLIP_NONE);
    }
    // The glowing edge marks exactly where the player stands.
    int lineWidth = 0;
    int lineHeight = 0;
    SDL_QueryTexture(m_LineTexture, NULL, NULL, &lineWidth, &lineHeight);
    const SDL_FRect line = {
        m_Game->getWidth() / 2.0f - lineWidth / 2.0f,
        screenY - lineHeight / 2.0f,
        static_cast<float>(lineWidth),
        static_cast<float>(lineHeight)
    };
    SDL_RenderCopyF(m_Renderer, m_LineTexture, NULL, &line);
}

void Ground::render() const {
    if (m_HasBounds) {
        renderStrip(m_BoundsBottom, false);
        renderStrip(m_BoundsTop, true);
    } else {
        renderStrip(m_Position.y, false);
    }
}

std::array<float, 3> Ground::getColor() const {
    return { m_Red, m_Green, m_Blue };
}

void Ground::setColor(std::array<float, 3> color) {
    m_Red = color[0];
    m_Green = color[1];
    m_Blue = color[2];
    SDL_SetTextureColorMod(m_GroundTexture, static_cast<uint8_t>(m_Red), static_cast<uint8_t>(m_Green), static_cast<uint8_t>(m_Blue));
}

SDL_Color Ground::getTargetColor() const {
    return { m_TargetRed, m_TargetGreen, m_TargetBlue, 255 };
}

void Ground::setTargetColor(SDL_Color color) {
    m_TargetRed = color.r;
    m_TargetGreen = color.g;
    m_TargetBlue = color.b;
}

float Ground::getFadeTime() const {
    return m_FadeTime;
}

void Ground::setFadeTime(float fadeTime) {
    m_FadeTime = fadeTime;
    m_IsFading = fadeTime > 0;
}
