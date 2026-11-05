#pragma once
#include "GameState.h"
#include "Button.h"
#include <array>
#include <SDL.h>
#include <SDL_ttf.h>
#include <SDL_mixer.h>
#include <string_view>
#include "Config.h"

class Game;

class LevelSelect : public GameState {
public:
    void init(Game *game) override;
    void destroy() override;
    void enter() override;
    void exit() override;
    void update(float deltaTime) override;
    void render() const override;
    inline int getLevelSelected() const { return m_LevelSelected; }
    void selectLevel(int level);
    int getBestPercentage() const;
    inline bool isCleared(int level) const { return level >= 0 && level < Config::SLOT_COUNT && m_BestLevelPercentages[level] >= 100; }
    void setBestPercentage(int value);
    int getBestPracticePercentage() const;
    // Coins kept by finishing the level, one bit per coin.
    int getSavedCoins() const;
    void saveCoins(int coins);
    int getTotalCoins() const;
    // Coins still needed to open a level; 0 when it is open.
    int coinsNeeded(int level) const;
    void setBestPracticePercentage(int value);
    inline SDL_Texture *getLevelNameTexture() const { return m_LevelNameTexture; }
    inline static LevelSelect &get() { return m_LevelSelect; }

private:
    static LevelSelect m_LevelSelect;
    int m_LevelSelected = 0;
    Button m_LeftLevelArrow;
    Button m_RightLevelArrow;
    Button m_TitleScreenArrow;
    Button m_EnterLevel;
    SDL_Rect m_LeftCornerRect;
    SDL_Rect m_RightCornerRect;
    SDL_Rect m_TopRect;
    SDL_Texture *m_CornerTexture;
    SDL_Texture *m_CoinTexture;
    SDL_Texture *m_CoinEmptyTexture;
    SDL_Texture *m_LockTexture;
    SDL_Texture *m_LockTextTexture = nullptr;
    SDL_Texture *m_TotalCoinsTexture = nullptr;
    SDL_Texture *m_TopTexture;
    SDL_Texture *m_LevelArrowTexture;
    SDL_Texture *m_TitleArrowTexture;
    SDL_Texture *m_LevelNameTexture;
    SDL_Texture *m_DifficultyTexture;
    SDL_Texture *m_BestPercentTexture;
    SDL_Texture *m_BestPracticePercentTexture;
    Mix_Chunk *m_PlaySound;
    std::array<int, Config::SLOT_COUNT> m_BestLevelPercentages;
    std::array<int, Config::SLOT_COUNT> m_BestPracticePercentages;
    std::array<int, Config::SLOT_COUNT> m_Coins;
    bool m_IsMouseHeld;
    bool m_IsEscapeHeld;
    bool m_IsSpaceHeld;

    void updateLevelNameTexture();
    void updateCoinTextures();
    // Storage slot of a level; the map maker level keeps its own slot.
    // localStorage key for a level's record: levels 1-21 and the map maker keep
    // their old keys (base + level, base + 99); levels 22-100 use base * 10 + level.
    static int storageKey(int base, int level);
    void moveSelection(int step);
    void updateBestPercentTexture();
    void updateBestPracticePercentTexture();
};

