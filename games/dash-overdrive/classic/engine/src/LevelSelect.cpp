#include "LevelSelect.h"
#include "PlayingState.h"
#include "Game.h"
#include "Text.h"
#include "Storage.h"
#include <SDL_image.h>
#include <iostream>

LevelSelect LevelSelect::m_LevelSelect;

void LevelSelect::init(Game *game) {
    GameState::init(game);
    m_Type = StateType::LEVEL_SELECT;
    m_Renderer = m_Game->getRenderer();
    m_CoinTexture = IMG_LoadTexture(m_Renderer, "res/gfx/coinIcon.png");
    m_CoinEmptyTexture = IMG_LoadTexture(m_Renderer, "res/gfx/coinEmpty.png");
    m_CornerTexture = IMG_LoadTexture(m_Renderer, "res/gfx/selectCorner.png");
    if (m_CornerTexture == nullptr) {
        std::cerr << "Failed to load selectCorner.png!" << SDL_GetError() << std::endl;
    }
    m_TopTexture = IMG_LoadTexture(m_Renderer, "res/gfx/top.png");
    if (m_TopTexture == nullptr) {
        std::cerr << "Failed to load top.png!" << SDL_GetError() << std::endl;
    }
    m_LevelArrowTexture = IMG_LoadTexture(m_Renderer, "res/gfx/levelArrow.png");
    if (m_LevelArrowTexture == nullptr) {
        std::cerr << "Failed to load levelArrow.png!" << SDL_GetError() << std::endl;
    }
    m_TitleArrowTexture = IMG_LoadTexture(m_Renderer, "res/gfx/toTitleScreen.png");
    if (m_TitleArrowTexture == nullptr) {
        std::cerr << "Failed to load toTitleScreen.png!" << SDL_GetError() << std::endl;
    }
    m_LevelNameTexture = nullptr;
    m_DifficultyTexture = nullptr;
    updateLevelNameTexture();
    m_BestPercentTexture = Text::createTexture(m_Renderer, "Normal: 0%");
    m_BestPracticePercentTexture = Text::createTexture(m_Renderer, "Practice: 0%");
    int cornerWidth = 0;
    int cornerHeight = 0;
    int topWidth = 0;
    int topHeight = 0;
    int levelArrowWidth = 0;
    int levelArrowHeight = 0;
    int titleArrowWidth = 0;
    int titleArrowHeight = 0;
    SDL_QueryTexture(m_CornerTexture, NULL, NULL, &cornerWidth, &cornerHeight);
    SDL_QueryTexture(m_TopTexture, NULL, NULL, &topWidth, &topHeight);
    SDL_QueryTexture(m_LevelArrowTexture, NULL, NULL, &levelArrowWidth, &levelArrowHeight);
    SDL_QueryTexture(m_TitleArrowTexture, NULL, NULL, &titleArrowWidth, &titleArrowHeight);
    const int width = m_Game->getWidth();
    const int height = m_Game->getHeight();
    const int xMargin = 40;
    const int yMargin = 20;
    m_LeftCornerRect = { 0, height - cornerHeight, cornerWidth, cornerHeight };
    m_RightCornerRect = { width - cornerWidth, height - cornerHeight, cornerWidth, cornerHeight };
    m_TopRect = { width/2 - topWidth/2, 0, topWidth, topHeight };
    m_LeftLevelArrow.init(
        m_Game, 
        m_LevelArrowTexture, 
        xMargin, 
        height/2, 
        levelArrowWidth, 
        levelArrowHeight, 
        false, 
        true,
        SDL_FLIP_HORIZONTAL
    );
    m_RightLevelArrow.init(
        m_Game, 
        m_LevelArrowTexture, 
        width - xMargin - levelArrowWidth, 
        height/2, 
        levelArrowWidth, 
        levelArrowHeight, 
        false, 
        true
    );
    m_TitleScreenArrow.init(
        m_Game,
        m_TitleArrowTexture,
        xMargin,
        yMargin,
        titleArrowWidth,
        titleArrowHeight
    );
    m_EnterLevel.init(
        m_Game,
        width/2,
        240,
        1200,
        360,
        {.r=0, .g=0, .b=0, .a=100},
        true
    );
    for (int i = 0; i < Config::SLOT_COUNT; i++) {
        m_BestLevelPercentages[i] = Storage::getInt(Storage::BEST + i, 0);
        m_BestPracticePercentages[i] = Storage::getInt(Storage::BEST_PRACTICE + i, 0);
        m_Coins[i] = Storage::getInt(Storage::COINS + i, 0);
    }
    updateBestPercentTexture();
    updateBestPracticePercentTexture();
    m_PlaySound = Mix_LoadWAV("res/sfx/playSound.ogg");
}

void LevelSelect::destroy() {
    SDL_DestroyTexture(m_CornerTexture);
    SDL_DestroyTexture(m_CoinTexture);
    SDL_DestroyTexture(m_CoinEmptyTexture);
    SDL_DestroyTexture(m_TopTexture);
    SDL_DestroyTexture(m_LevelArrowTexture);
    SDL_DestroyTexture(m_TitleArrowTexture);
    SDL_DestroyTexture(m_LevelNameTexture);
    SDL_DestroyTexture(m_DifficultyTexture);
    SDL_DestroyTexture(m_BestPercentTexture);
    SDL_DestroyTexture(m_BestPracticePercentTexture);
    Mix_FreeChunk(m_PlaySound);
}

void LevelSelect::enter() {
    m_IsMouseHeld = false;
    m_IsEscapeHeld = false;
    m_IsSpaceHeld = false;
}

void LevelSelect::selectLevel(int level) {
    m_LevelSelected = ((level % Config::SLOT_COUNT) + Config::SLOT_COUNT) % Config::SLOT_COUNT;
    updateLevelNameTexture();
    updateBestPercentTexture();
    updateBestPracticePercentTexture();
}

void LevelSelect::exit() {

}

void LevelSelect::update(float /*deltaTime*/) {
    const bool isEscapeHeld = m_Game->isEscapeHeld();
    const bool isEscapeReleased = m_IsEscapeHeld && !isEscapeHeld;
    m_IsEscapeHeld = isEscapeHeld;
    if (isEscapeReleased) {
        m_Game->popState();
        return;
    }
    Background &background = m_Game->getBackground();
    Ground &ground = m_Game->getGround();
    ground.setPosition({0, static_cast<float>(Config::HEIGHT - 2*Config::TILE_SIZE)});
    ground.setBounds(false, 0, 0);
    background.setMoving(false);

    const bool isSpaceHeld = m_Game->isSpaceHeld();
    const bool spaceReleased = m_IsSpaceHeld && !isSpaceHeld;
    m_IsSpaceHeld = isSpaceHeld;

    m_TitleScreenArrow.update();
    if (m_TitleScreenArrow.isPressed()) {
        m_Game->popState();
        return;
    }
    m_LeftLevelArrow.update();
    if (m_LeftLevelArrow.isPressed()) {
        moveSelection(-1);
    }
    m_RightLevelArrow.update();
    if (m_RightLevelArrow.isPressed()) {
        moveSelection(1);
    }
    m_EnterLevel.update();
    if (m_EnterLevel.isPressed() || spaceReleased) {
        Mix_PlayChannel(0, m_PlaySound, 0);
        m_Game->pushState(PlayingState::get());
    }
}

void LevelSelect::moveSelection(int step) {
    // The arrows only walk through the built-in levels; the map maker level is
    // reached from the CREATE button.
    if (m_LevelSelected >= Config::LEVEL_COUNT) {
        m_LevelSelected = step > 0 ? 0 : Config::LEVEL_COUNT - 1;
    } else {
        m_LevelSelected = (m_LevelSelected + step + Config::LEVEL_COUNT) % Config::LEVEL_COUNT;
    }
    updateLevelNameTexture();
    updateBestPercentTexture();
    updateBestPracticePercentTexture();
}

void LevelSelect::render() const {
    // render textures
    SDL_RenderCopyEx(m_Renderer, m_CornerTexture, NULL, &m_LeftCornerRect, 0, NULL, SDL_FLIP_NONE);
    SDL_RenderCopyEx(m_Renderer, m_CornerTexture, NULL, &m_RightCornerRect, 0, NULL, SDL_FLIP_HORIZONTAL);
    SDL_RenderCopyEx(m_Renderer, m_TopTexture, NULL, &m_TopRect, 0, NULL, SDL_FLIP_NONE);
    m_TitleScreenArrow.render();
    m_LeftLevelArrow.render();
    m_RightLevelArrow.render();
    m_EnterLevel.render();

    Text::renderTexture(m_Renderer, m_LevelNameTexture, m_Game->getWidth()/2, m_EnterLevel.getY() + m_EnterLevel.getH()/2 - 30, true, true);
    Text::renderTexture(m_Renderer, m_DifficultyTexture, m_Game->getWidth()/2, m_EnterLevel.getY() + m_EnterLevel.getH() - 95, true, false, 0.45f);
    constexpr int MARGIN = 50;
    const int bestPercentY = m_EnterLevel.getY() + m_EnterLevel.getH() + MARGIN;
    Text::renderTexture(m_Renderer, m_BestPercentTexture, m_Game->getWidth()/2, bestPercentY, true, false, 0.5f);
    Text::renderTexture(m_Renderer, m_BestPracticePercentTexture, m_Game->getWidth()/2, bestPercentY + 2*MARGIN, true, false, 0.5f);
    // the three coins of a built-in level
    if (m_LevelSelected < Config::LEVEL_COUNT) {
        constexpr int COIN_SIZE = 72;
        constexpr int COIN_GAP = 22;
        const int left = m_Game->getWidth()/2 - (3*COIN_SIZE + 2*COIN_GAP)/2;
        for (int i = 0; i < 3; i++) {
            const SDL_Rect coin = { left + i*(COIN_SIZE + COIN_GAP), bestPercentY + 4*MARGIN, COIN_SIZE, COIN_SIZE };
            SDL_RenderCopy(m_Renderer, (m_Coins[m_LevelSelected] >> i) & 1 ? m_CoinTexture : m_CoinEmptyTexture, NULL, &coin);
        }
    }
}

int LevelSelect::getBestPercentage() const {
    return m_BestLevelPercentages[m_LevelSelected];
}

void LevelSelect::setBestPercentage(int value) {
    m_BestLevelPercentages[m_LevelSelected] = value;
    Storage::setInt(Storage::BEST + m_LevelSelected, value);
    updateBestPercentTexture();
}

int LevelSelect::getSavedCoins() const {
    return m_Coins[m_LevelSelected];
}

void LevelSelect::saveCoins(int coins) {
    m_Coins[m_LevelSelected] |= coins;
    Storage::setInt(Storage::COINS + m_LevelSelected, m_Coins[m_LevelSelected]);
}

int LevelSelect::getBestPracticePercentage() const {
    return m_BestPracticePercentages[m_LevelSelected];
}

void LevelSelect::setBestPracticePercentage(int value) {
    m_BestPracticePercentages[m_LevelSelected] = value;
    Storage::setInt(Storage::BEST_PRACTICE + m_LevelSelected, value);
    updateBestPracticePercentTexture();
}

void LevelSelect::updateLevelNameTexture() {
    SDL_DestroyTexture(m_LevelNameTexture);
    m_LevelNameTexture = Text::createTexture(m_Renderer, std::string(m_LevelStrings[m_LevelSelected]));
    SDL_DestroyTexture(m_DifficultyTexture);
    const std::string number = m_LevelSelected < Config::LEVEL_COUNT ? "Level " + std::to_string(m_LevelSelected + 1) + "  -  " : "";
    m_DifficultyTexture = Text::createTexture(m_Renderer, number + std::string(m_Difficulties[m_LevelSelected]));
}

void LevelSelect::updateBestPercentTexture() {
    SDL_DestroyTexture(m_BestPercentTexture);
    m_BestPercentTexture = Text::createTexture(m_Renderer, "Normal: " + std::to_string(m_BestLevelPercentages[m_LevelSelected]) + "%");
}

void LevelSelect::updateBestPracticePercentTexture() {
    SDL_DestroyTexture(m_BestPracticePercentTexture);
    m_BestPracticePercentTexture = Text::createTexture(m_Renderer, "Practice: " + std::to_string(m_BestPracticePercentages[m_LevelSelected]) + "%");
}
