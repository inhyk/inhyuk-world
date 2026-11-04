#include "SkinSelect.h"
#include "Game.h"
#include "Player.h"
#include "Text.h"
#include <SDL_image.h>
#include <algorithm>
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
    m_LockTexture = IMG_LoadTexture(m_Renderer, "res/gfx/skinLock.png");
    m_HintTexture = Text::createTexture(m_Renderer, "Finish a level to get a new skin");
    for (int i = 0; i < Config::SKIN_COUNT; i++) {
        m_LevelTextures[i] = i < Config::FREE_SKINS ? nullptr : Text::createTexture(m_Renderer, "Lv " + std::to_string(i - Config::FREE_SKINS + 1));
    }
    int backWidth = 0;
    int backHeight = 0;
    SDL_QueryTexture(m_BackTexture, NULL, NULL, &backWidth, &backHeight);
    m_BackButton.init(m_Game, m_BackTexture, 40, 20, backWidth, backHeight);

    const int rows = (Config::SKIN_COUNT + COLUMNS - 1) / COLUMNS;
    const int gridWidth = COLUMNS * SLOT_SIZE + (COLUMNS - 1) * SLOT_GAP;
    const int gridHeight = rows * SLOT_SIZE + (rows - 1) * SLOT_GAP;
    const int left = m_Game->getWidth() / 2 - gridWidth / 2;
    const int top = 600 - gridHeight / 2;
    for (int i = 0; i < Config::SKIN_COUNT; i++) {
        // a short last row sits in the middle
        const int inRow = std::min(COLUMNS, Config::SKIN_COUNT - (i / COLUMNS) * COLUMNS);
        const int rowLeft = left + (COLUMNS - inRow) * (SLOT_SIZE + SLOT_GAP) / 2;
        const int x = rowLeft + (i % COLUMNS) * (SLOT_SIZE + SLOT_GAP);
        const int y = top + (i / COLUMNS) * (SLOT_SIZE + SLOT_GAP);
        m_SlotButtons[i].init(m_Game, m_SlotTexture, x, y, SLOT_SIZE, SLOT_SIZE);
    }
}

void SkinSelect::destroy() {
    SDL_DestroyTexture(m_SlotTexture);
    SDL_DestroyTexture(m_SelectedTexture);
    SDL_DestroyTexture(m_BackTexture);
    SDL_DestroyTexture(m_HeadingTexture);
    SDL_DestroyTexture(m_LockTexture);
    SDL_DestroyTexture(m_HintTexture);
    for (SDL_Texture *texture : m_LevelTextures) {
        SDL_DestroyTexture(texture);
    }
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
        if (m_SlotButtons[i].isPressed() && m_Game->isSkinUnlocked(i)) {
            m_Game->setSelectedSkin(i);
        }
    }
}

void SkinSelect::render() const {
    Text::renderTexture(m_Renderer, m_HeadingTexture, m_Game->getWidth() / 2, 110, true, true, 0.8f);
    Text::renderTexture(m_Renderer, m_HintTexture, m_Game->getWidth() / 2, 200, true, false, 0.4f);
    m_BackButton.render();
    const int selected = m_Game->getSelectedSkin();
    for (int i = 0; i < Config::SKIN_COUNT; i++) {
        const Button &slot = m_SlotButtons[i];
        if (i == selected) {
            const SDL_Rect glow = { slot.getX() - 9, slot.getY() - 9, SLOT_SIZE + 18, SLOT_SIZE + 18 };
            SDL_RenderCopy(m_Renderer, m_SelectedTexture, NULL, &glow);
        }
        slot.render();
        const float size = i == selected ? 112.0f + std::sin(m_Time * 0.1f) * 5.0f : 106.0f;
        const SDL_FRect skin = {
            slot.getX() + (SLOT_SIZE - size) / 2.0f,
            slot.getY() + (SLOT_SIZE - size) / 2.0f,
            size,
            size
        };
        SDL_RenderCopyF(m_Renderer, m_Game->getSkinTexture(i), NULL, &skin);
        if (!m_Game->isSkinUnlocked(i)) {
            // locked: dark cover with a padlock and the level that opens it
            const SDL_Rect cover = { slot.getX(), slot.getY(), SLOT_SIZE, SLOT_SIZE };
            SDL_RenderCopy(m_Renderer, m_LockTexture, NULL, &cover);
            Text::renderTexture(m_Renderer, m_LevelTextures[i], slot.getX() + SLOT_SIZE / 2, slot.getY() + SLOT_SIZE - 44, true, false, 0.32f);
        }
    }
}
