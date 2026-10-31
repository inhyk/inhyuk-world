#pragma once
#include <array>
#include <SDL_mixer.h>
#include <SDL_ttf.h>
#include "Player.h"
#include "LevelManager.h"
#include "Config.h"
#include "GameState.h"
#include "Button.h"

class PlayingState : public GameState {
public:
    void init(Game *game) override;
    void destroy() override;
    void enter() override;
    void exit() override;
    void update(float deltaTime) override;
    void render() const override;
    inline int getMinY() const { return m_MinY; }
    inline bool isInPractice() const { return m_IsInPractice; }
    inline bool isPaused() const { return m_IsPaused; }
    inline int getLevelPercent() const { return m_LevelPercent; }
    // we don't want the player to jump when the player tries to pause
    bool playerShouldIgnoreMouseClicks() const;
    inline const std::vector<Object> &getObjects() const { return m_LevelManager.getObjects(); }
    inline const LevelManager &getLevel() const { return m_LevelManager; }
    inline std::vector<Trigger> &getTriggers() { return m_LevelManager.getTriggers(); }
    inline SDL_Color getInitialBackground() const { return m_InitialBackground; }
    inline SDL_Color getInitialGround() const { return m_InitialGround; }
    inline void setCustomSong(int song) { m_CustomSong = song; }
    inline static PlayingState &get() { return m_PlayingState; }

    // Level checker: runs the real physics without drawing or sound.
    int simLoad(int level);
    int simStep(bool held, float deltaTime);
    inline Player &getPlayer() { return m_Player; }

private:
    static PlayingState m_PlayingState;
    Player m_Player;
    LevelManager m_LevelManager;
    SDL_Texture *m_LevelEndBlockTexture;
    SDL_Texture *m_ResumeTexture;
    SDL_Texture *m_ExitTexture;
    SDL_Texture *m_EnterPracticeTexture;
    SDL_Texture *m_ExitPracticeTexture;
    SDL_Texture *m_PauseTexture;
    SDL_Texture *m_PlaceCheckpointTexture;
    SDL_Texture *m_RemoveCheckpointTexture;
    SDL_Texture *m_NewBestTexture;
    SDL_Texture *m_LevelPercentTexture;
    SDL_Texture *m_LevelCompleteTextTexture;
    SDL_Texture *m_LoadingTexture;
    SDL_Texture *m_CoinTexture;
    SDL_Texture *m_CoinEmptyTexture;
    Mix_Chunk *m_LevelCompleteSound;
    Mix_Music *m_PracticeMusic;
    Mix_Music *m_Song = nullptr;
    // The page writes an empty song file when the download failed: play silently.
    bool m_SongMissing = false;
    static constexpr int MARGIN = 50;
    static constexpr int BLOCK_HEIGHT_LIMIT = 50 * Config::TILE_SIZE;
    // Songs are downloaded when a level starts; wait this long (frames) before
    // starting without music.
    static constexpr float SONG_WAIT_LIMIT = 8 * 60;
    int m_MinY;
    Button m_ResumeButton;
    Button m_ExitButton;
    Button m_EnterPracticeButton;
    Button m_ExitPracticeButton;
    Button m_PauseButton;
    Button m_PlaceCheckpointButton;
    Button m_RemoveCheckpointButton;
    float m_LevelBeginTimer;
    float m_SongWaitTime;
    bool m_IsTimerFinished;
    bool m_IsSongPlaying;
    bool m_IsPlayerDead;
    bool m_IsEscapeHeld;
    bool m_IsSpaceHeld;
    bool m_IsZHeld;
    bool m_IsXHeld;
    bool m_IsPaused;
    bool m_ShouldEndLevel;
    bool m_JustSetNewBest;
    int m_LevelEndBlocksX;
    float m_TimeEndingLevel;
    bool m_IsLevelComplete;
    int m_LevelPercent; // ex: 3692 = 36.92%
    bool m_IsInPractice;
    int m_Level = 0;
    int m_SongIndex = 0;
    int m_CustomSong = 0;
    SDL_Color m_InitialBackground = { 0, 0, 255 };
    SDL_Color m_InitialGround = { 0, 0, 255 };

    void updatePause(bool isEscapeReleased);
    void updateEndLevel(float deltaTime);
    void updateLevelComplete(bool isEscapeReleased);
    void updateNewBest();
    bool prepareSong();
    void startSong();
    void renderPause() const;
    void renderEndBlocks() const;
    void renderCoins() const;
    void renderLevelCompleteMenu() const;
    void pause();
    void resume();
    void resetMusic();
    void attemptResetTimer();
    void updateNewBestTexture();
    void updateLevelPercentTexture();
    void updateLevelCompleteTextTexture();
};
