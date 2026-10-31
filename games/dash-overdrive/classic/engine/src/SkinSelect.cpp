#include "SkinSelect.h"
#include "Game.h"
#include "Player.h"
#include "Text.h"
#include <SDL_image.h>
#include <cmath>
#include <iostream>

SkinSelect SkinSelect::m_SkinSelect;

void SkinSelect::init(Game *game) {
    GameState::init(game);
    m_Type = StateType::SKIN_SELECT;
    m_SlotTexture = IMG_LoadTexture(m_Renderer, "res/gfx/skinSlot.png");
    m_SelectedTexture = IMG_LoadTexture(m_Renderer, "res/gfx/skinSelected.png");
    m_BackTexture = IMG_LoadTexture(m_Renderer, "res/gfx/toTitleScreen.png");
    if (m_SlotTexture == nullptr || m_SelectedTexture == nullptr || m_BackTexture == nullptr) {
        std::cerr << "Failed to load skin picker textures! " << SDL_GetError() << std::endl;
    }
    m_HeadingTexture = Text::createTexture(m_Renderer, "SKINS");
    int backWidth = 0;
    int backHeight = 0;
    SDL_QueryTexture(m_BackTexture, NULL, NULL, &backWidth, &backHeight);
    m_BackButton.init(m_Game, m_BackTexture, 40, 20, backWidth, backHeight);

    const int rows = (Config::SKIN_COUNT + COLUMNS - 1) / COLUMNS;
    const int gridWidth = COLUMNS * SLOT_SIZE + (COLUMNS - 1) * SLOT_GAP;
    const int gridHeight = rows * SLOT_SIZE + (rows - 1) * SLOT_GAP;
    const int left = m_Game->getWidth() / 2 - gridWidth / 2;
    const int top = 560 - gridHeight / 2;
    for (int i = 0; i < Config::SKIN_COUNT; i++) {
        const int x = left + (i % COLUMNS) * (SLOT_SIZE + SLOT_GAP);
        const int y = top + (i / COLUMNS) * (SLOT_SIZE + SLOT_GAP);
        m_SlotButtons[i].init(m_Game, m_SlotTexture, x, y, SLOT_SIZE, SLOT_SIZE);
    }
}

void SkinSelect::destroy() {
    SDL_DestroyTexture(m_SlotTexture);
    SDL_DestroyTexture(m_SelectedTexture);
    SDL_DestroyTexture(m_BackTexture);
    SDL_DestroyTexture(m_HeadingTexture);
}

void SkinSelect::enter() {
    m_IsEscapeHeld = false;
}

void SkinSelect::exit() {

}

void SkinSelect::update(float deltaTime) {
    m_Time += deltaTime;
    const bool isEscapeHeld = m_Game->isEscapeHeld();
    const bool isEscapeReleased = m_IsEscapeHeld && !isEscapeHeld;
    m_IsEscapeHeld = isEscapeHeld;

    Ground &ground = m_Game->getGround();
    Background &background = m_Game->getBackground();
    ground.setPosition({ground.getPosition().x, static_cast<float>(Config::FLOOR_Y)});
    ground.clearBounds();
    background.setMoving(true);
    background.update(deltaTime);
    ground.update(deltaTime);
    ground.move(-Player::DEFAULT_X_VELOCITY / 3, deltaTime);

    m_BackButton.update();
    if (m_BackButton.isPressed() || isEscapeReleased) {
        m_Game->popState();
        return;
    }
    for (int i = 0; i < Config::SKIN_COUNT; i++) {
        m_SlotButtons[i].update();
        if (m_SlotButtons[i].isPressed()) {
            m_Game->setSelectedSkin(i);
        }
    }
}

void SkinSelect::render() const {
    Text::renderTexture(m_Renderer, m_HeadingTexture, m_Game->getWidth() / 2, 130, true, true, 0.8f);
    m_BackButton.render();
    const int selected = m_Game->getSelectedSkin();
    for (int i = 0; i < Config::SKIN_COUNT; i++) {
        const Button &slot = m_SlotButtons[i];
        if (i == selected) {
            const SDL_Rect glow = { slot.getX() - 10, slot.getY() - 10, SLOT_SIZE + 20, SLOT_SIZE + 20 };
            SDL_RenderCopy(m_Renderer, m_SelectedTexture, NULL, &glow);
        }
        slot.render();
        const float size = i == selected ? 136.0f + std::sin(m_Time * 0.1f) * 6.0f : 128.0f;
        const SDL_FRect skin = {
            slot.getX() + (SLOT_SIZE - size) / 2.0f,
            slot.getY() + (SLOT_SIZE - size) / 2.0f,
            size,
            size
        };
        SDL_RenderCopyF(m_Renderer, m_Game->getSkinTexture(i), NULL, &skin);
    }
}
