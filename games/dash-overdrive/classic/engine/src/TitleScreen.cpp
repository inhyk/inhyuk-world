#include "TitleScreen.h"
#include "LevelSelect.h"
#include "SkinSelect.h"
#include <SDL_image.h>
#include <algorithm>
#include <cmath>
#include <iostream>
#include "Game.h"
#include "Player.h"
#include "Text.h"
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

// The main screen follows the designer's sketch: SKINS, PLAY and CREATE (make a
// map) side by side, with every skin's cube running past behind them.

TitleScreen TitleScreen::m_TitleScreen;

namespace {
constexpr float PARADE_SIZE = 96.0f;
constexpr float PARADE_SPEED = 7.0f;
constexpr float PARADE_GRAVITY = 1.7f;
constexpr float PARADE_JUMP = -27.0f;
constexpr float PARADE_SPACING = 64.0f; // frames between cubes
constexpr int BUTTON_GAP = 470;
}

void TitleScreen::init(Game *game) {
    GameState::init(game);
    m_Type = StateType::TITLE_SCREEN;
    m_TitleTexture = IMG_LoadTexture(m_Renderer, "res/gfx/title.png");
    if (m_TitleTexture == NULL) {
        std::cerr << "Failed to load title.png! " << SDL_GetError() << std::endl;
    }
    m_TitlePlayTexture = IMG_LoadTexture(m_Renderer, "res/gfx/titlePlay.png");
    if (m_TitlePlayTexture == NULL) {
        std::cerr << "Failed to load titlePlay.png! " << SDL_GetError() << std::endl;
    }
    m_SkinsTexture = IMG_LoadTexture(m_Renderer, "res/gfx/skinsButton.png");
    m_CreateTexture = IMG_LoadTexture(m_Renderer, "res/gfx/createButton.png");
    if (m_SkinsTexture == nullptr || m_CreateTexture == nullptr) {
        std::cerr << "Failed to load title buttons! " << SDL_GetError() << std::endl;
    }
    m_SkinsLabelTexture = Text::createTexture(m_Renderer, "SKINS");
    m_PlayLabelTexture = Text::createTexture(m_Renderer, "PLAY");
    m_CreateLabelTexture = Text::createTexture(m_Renderer, "CREATE");
    int titleWidth = 0;
    int titleHeight = 0;
    int titlePlayWidth = 0;
    int titlePlayHeight = 0;
    int sideWidth = 0;
    int sideHeight = 0;
    SDL_QueryTexture(m_TitleTexture, NULL, NULL, &titleWidth, &titleHeight);
    SDL_QueryTexture(m_TitlePlayTexture, NULL, NULL, &titlePlayWidth, &titlePlayHeight);
    SDL_QueryTexture(m_SkinsTexture, NULL, NULL, &sideWidth, &sideHeight);
    const int width = m_Game->getWidth();
    const int menuY = 590;
    m_TitleRect = { width/2 - titleWidth/2, 90, titleWidth, titleHeight };
    m_TitlePlay.init(m_Game, m_TitlePlayTexture, width/2, menuY, titlePlayWidth, titlePlayHeight, true, true);
    m_SkinsButton.init(m_Game, m_SkinsTexture, width/2 - BUTTON_GAP, menuY, sideWidth, sideHeight, true, true);
    m_CreateButton.init(m_Game, m_CreateTexture, width/2 + BUTTON_GAP, menuY, sideWidth, sideHeight, true, true);
}

void TitleScreen::destroy() {
    SDL_DestroyTexture(m_TitleTexture);
    SDL_DestroyTexture(m_TitlePlayTexture);
    SDL_DestroyTexture(m_SkinsTexture);
    SDL_DestroyTexture(m_CreateTexture);
    SDL_DestroyTexture(m_SkinsLabelTexture);
    SDL_DestroyTexture(m_PlayLabelTexture);
    SDL_DestroyTexture(m_CreateLabelTexture);
}

void TitleScreen::enter() {
    m_IsMouseHeld = false;
    m_IsEscapeHeld = false;
    m_IsSpaceHeld = false;
}

void TitleScreen::exit() {

}

float TitleScreen::nextRandom() {
    m_Random = m_Random * 1664525u + 1013904223u;
    return static_cast<float>((m_Random >> 8) & 0xFFFF) / 65535.0f;
}

void TitleScreen::updateParade(float deltaTime) {
    const float floorY = static_cast<float>(Config::FLOOR_Y) - PARADE_SIZE;
    m_SpawnTimer -= deltaTime;
    if (m_SpawnTimer <= 0) {
        m_SpawnTimer += PARADE_SPACING + nextRandom() * 30.0f;
        m_Parade.push_back({ m_NextParadeSkin, -PARADE_SIZE - 20, floorY, 0, 0, 20 + nextRandom() * 60 });
        m_NextParadeSkin = (m_NextParadeSkin + 1) % Config::SKIN_COUNT;
    }
    for (ParadeCube &cube : m_Parade) {
        cube.x += PARADE_SPEED * deltaTime;
        const bool grounded = cube.y >= floorY && cube.yVelocity >= 0;
        if (grounded) {
            cube.jumpTimer -= deltaTime;
            if (cube.jumpTimer <= 0) {
                cube.yVelocity = PARADE_JUMP;
                cube.jumpTimer = 25 + nextRandom() * 70;
            }
        }
        if (!grounded || cube.yVelocity < 0) {
            cube.yVelocity += PARADE_GRAVITY * deltaTime;
            cube.y += cube.yVelocity * deltaTime;
            cube.rotation += 7.5f * deltaTime;
            if (cube.y >= floorY) {
                cube.y = floorY;
                cube.yVelocity = 0;
                cube.rotation = std::round(cube.rotation / 90.0f) * 90.0f;
            }
        }
    }
    const float limit = static_cast<float>(m_Game->getWidth()) + 40;
    m_Parade.erase(std::remove_if(m_Parade.begin(), m_Parade.end(), [limit](const ParadeCube &cube) {
        return cube.x > limit;
    }), m_Parade.end());
}

void TitleScreen::update(float deltaTime) {
    m_Time += deltaTime;
    const bool isEscapeHeld = m_Game->isEscapeHeld();
    const bool isEscapeReleased = m_IsEscapeHeld && !isEscapeHeld;
    m_IsEscapeHeld = isEscapeHeld;
    if (isEscapeReleased) {
#ifndef __EMSCRIPTEN__
        m_Game->popState();
#endif
    }
    Ground &ground = m_Game->getGround();
    Background &background = m_Game->getBackground();
    ground.setPosition({ground.getPosition().x, static_cast<float>(Config::FLOOR_Y)});
    ground.clearBounds();
    background.setMoving(true);
    background.update(deltaTime);
    ground.update(deltaTime);
    ground.move(-Player::DEFAULT_X_VELOCITY, deltaTime);
    updateParade(deltaTime);

    const bool isSpaceHeld = m_Game->isSpaceHeld();
    const bool spaceReleased = m_IsSpaceHeld && !isSpaceHeld;
    m_IsSpaceHeld = isSpaceHeld;

    m_TitlePlay.update();
    m_SkinsButton.update();
    m_CreateButton.update();
    if (m_SkinsButton.isPressed()) {
        m_Game->pushState(SkinSelect::get());
        return;
    }
    if (m_CreateButton.isPressed()) {
#ifdef __EMSCRIPTEN__
        EM_ASM({ if (Module.classicOpenEditor) Module.classicOpenEditor(); });
#endif
        return;
    }
    if (m_TitlePlay.isPressed() || spaceReleased) {
        m_Game->pushState(LevelSelect::get());
    }
}

void TitleScreen::renderLabel(SDL_Texture *label, const Button &button) const {
    Text::renderTexture(m_Renderer, label, button.getX() + button.getW() / 2, button.getY() + button.getH() + 6, true, false, 0.42f);
}

void TitleScreen::render() const {
    // the parade runs behind everything else on this screen
    const SDL_FPoint camera = m_Game->getCameraPosition();
    for (const ParadeCube &cube : m_Parade) {
        const SDL_FRect dst = { cube.x - camera.x, cube.y - camera.y, PARADE_SIZE, PARADE_SIZE };
        SDL_RenderCopyExF(m_Renderer, m_Game->getSkinTexture(cube.skin), NULL, &dst, cube.rotation, NULL, SDL_FLIP_NONE);
    }

    SDL_RenderCopy(m_Renderer, m_TitleTexture, NULL, &m_TitleRect);
    m_SkinsButton.render();
    m_TitlePlay.render();
    m_CreateButton.render();

    // the chosen skin sits inside the SKINS button and bobs a little
    const float bob = std::sin(m_Time * 0.08f) * 6.0f;
    const float skinSize = 150.0f;
    const SDL_FRect skin = {
        m_SkinsButton.getX() + (m_SkinsButton.getW() - skinSize) / 2.0f,
        m_SkinsButton.getY() + (m_SkinsButton.getH() - skinSize) / 2.0f + bob,
        skinSize,
        skinSize
    };
    SDL_RenderCopyF(m_Renderer, m_Game->getSkinTexture(m_Game->getSelectedSkin()), NULL, &skin);

    renderLabel(m_SkinsLabelTexture, m_SkinsButton);
    renderLabel(m_PlayLabelTexture, m_TitlePlay);
    renderLabel(m_CreateLabelTexture, m_CreateButton);
}
