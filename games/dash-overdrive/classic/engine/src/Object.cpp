#include <SDL_image.h>
#include <iostream>
#include "Game.h"
#include "Object.h"
#include <cmath>

Object::Object(Game *game, ObjectType type, int rotation, SDL_FPoint pos, std::optional<SDL_FRect> hitbox, bool xFlip, bool yFlip, SDL_Texture *objectTexture)
    : m_Game(game), m_Type(type), m_Rotation(rotation), m_Position(pos), m_Hitbox(hitbox), m_FlipX(xFlip), m_FlipY(yFlip), m_ObjectTexture(objectTexture) {
    
    m_Renderer = m_Game->getRenderer();
    if (m_ObjectTexture != nullptr) {
        SDL_QueryTexture(m_ObjectTexture, NULL, NULL, &m_Width, &m_Height);
    } else {
        m_Width = 0;
        m_Height = 0;
    }
    // in sdl you can't do both flips at the same time ¯\_(ツ)_/¯
    if (m_FlipX && m_FlipY) {
        m_FlipX = false;
        m_FlipY = false;
        m_Rotation += 2;
    }
}

std::optional<SDL_FRect> Object::getHitbox() const {
    return m_Hitbox;
}

SDL_FPoint Object::getPos() const {
    return m_Position;
}

int Object::getWidth() const {
    return m_Width;
}

int Object::getHeight() const {
    return m_Height;
}

ObjectType Object::getType() const {
    return m_Type;
}

void Object::render() const {
    // some objects don't have textures
    if (m_ObjectTexture == nullptr) {
        return;
    }
    SDL_Rect dst = {
        .x = static_cast<int>(m_Position.x - m_Game->getCameraPosition().x),
        .y = static_cast<int>(m_Position.y - m_Game->getCameraPosition().y),
        .w = m_Width,
        .h = m_Height
    };

    SDL_RendererFlip flip = SDL_FLIP_NONE;
    if (m_FlipX) {
        flip = SDL_FLIP_HORIZONTAL;
    } else if (m_FlipY) {
        flip = SDL_FLIP_VERTICAL;
    }
    SDL_RenderCopyEx(m_Renderer, m_ObjectTexture, NULL, &dst, m_Rotation * 90.0, NULL, flip);
    if (m_Sparkle) {
        renderSparkle(dst.x + dst.w / 2, dst.y + dst.w / 2);
    }
    
    // this just draws hitboxes for debugging
    // SDL_FRect temp = m_Hitbox;
    // temp.x -= m_Game->getCameraPosition().x;
    // temp.y -= m_Game->getCameraPosition().y;
    // SDL_SetRenderDrawColor(m_Renderer, 255, 0, 0, 125);
    // SDL_RenderFillRectF(m_Renderer, &temp);
}

void Object::renderSparkle(int x, int y) const {
    // every pole has its own moment in a 2.6 second cycle
    constexpr Uint32 CYCLE = 2600;
    constexpr float FLASH = 420.0f;
    const Uint32 phase = (SDL_GetTicks() + static_cast<Uint32>(std::abs(m_Position.x) * 7.3f)) % CYCLE;
    if (phase > FLASH) {
        return;
    }
    const float t = phase / FLASH;
    const float strength = std::sin(t * 3.14159265f);
    const float arm = 10.0f + 46.0f * strength;
    const float thick = 2.0f + 4.0f * strength;
    SDL_SetRenderDrawBlendMode(m_Renderer, SDL_BLENDMODE_ADD);
    SDL_SetRenderDrawColor(m_Renderer, 230, 255, 190, static_cast<Uint8>(230 * strength));
    const SDL_FRect horizontal = { x - arm, y - thick / 2, arm * 2, thick };
    const SDL_FRect vertical = { x - thick / 2, y - arm, thick, arm * 2 };
    SDL_RenderFillRectF(m_Renderer, &horizontal);
    SDL_RenderFillRectF(m_Renderer, &vertical);
    const float glow = 8.0f + 14.0f * strength;
    const SDL_FRect core = { x - glow / 2, y - glow / 2, glow, glow };
    SDL_RenderFillRectF(m_Renderer, &core);
    SDL_SetRenderDrawBlendMode(m_Renderer, SDL_BLENDMODE_BLEND);
}
