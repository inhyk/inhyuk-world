#include "PlayingState.h"
#include "Game.h"
#include "Player.h"
#include "LevelManager.h"
#include "LevelSelect.h"
#include "Text.h"
#include <SDL_image.h>
#include <string>
#include <fstream>
#include <algorithm>
#include <iostream>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

PlayingState PlayingState::m_PlayingState;

namespace {
std::string songPath(int song) {
    return "music/" + std::to_string(song) + ".ogg";
}
}

void PlayingState::init(Game *game) {
    GameState::init(game);
    m_Type = StateType::PLAYING_STATE;
    m_Player.init(m_Game);
    m_LevelManager.init(m_Game);
    m_LevelEndBlockTexture = IMG_LoadTexture(m_Renderer, "res/gfx/objects/2.png");
    if (m_LevelEndBlockTexture == nullptr) {
        std::cerr << "Failed to load 2.png! " << SDL_GetError() << '\n';
    }
    m_ResumeTexture = IMG_LoadTexture(m_Renderer, "res/gfx/resume.png");
    if (m_ResumeTexture == nullptr) {
        std::cerr << "Failed to load resume.png! " << SDL_GetError() << '\n';
    }
    m_ExitTexture = IMG_LoadTexture(m_Renderer, "res/gfx/exitLevel.png");
    if (m_ExitTexture == nullptr) {
        std::cerr << "Failed to load exitLevel.png! " << SDL_GetError() << '\n';
    }
    m_EnterPracticeTexture = IMG_LoadTexture(m_Renderer, "res/gfx/enterPractice.png");
    if (m_EnterPracticeTexture == nullptr) {
        std::cerr << "Failed to load enterPractice.png! " << SDL_GetError() << '\n';
    }
    m_ExitPracticeTexture = IMG_LoadTexture(m_Renderer, "res/gfx/exitPractice.png");
    if (m_ExitPracticeTexture == nullptr) {
        std::cerr << "Failed to load exitPractice.png! " << SDL_GetError() << '\n';
    }
    m_PauseTexture = IMG_LoadTexture(m_Renderer, "res/gfx/pause.png");
    if (m_PauseTexture == nullptr) {
        std::cerr << "Failed to load pause.png! " << SDL_GetError() << '\n';
    }
    m_PlaceCheckpointTexture = IMG_LoadTexture(m_Renderer, "res/gfx/placeCheckpoint.png");
    if (m_PlaceCheckpointTexture == nullptr) {
        std::cerr << "Failed to load placeCheckpoint.png! " << SDL_GetError() << '\n';
    }
    m_RemoveCheckpointTexture = IMG_LoadTexture(m_Renderer, "res/gfx/removeCheckpoint.png");
    if (m_RemoveCheckpointTexture == nullptr) {
        std::cerr << "Failed to load removeCheckpoint.png! " << SDL_GetError() << '\n';
    }
    m_NewBestTexture = Text::createTexture(m_Renderer, "New Best! 0%");
    m_LevelPercentTexture = Text::createTexture(m_Renderer, "0.00%");
    m_LevelCompleteTextTexture = Text::createTexture(m_Renderer, "Level Complete!");
    m_LoadingTexture = Text::createTexture(m_Renderer, "Loading music...");
    m_CoinTexture = IMG_LoadTexture(m_Renderer, "res/gfx/coinIcon.png");
    m_CoinEmptyTexture = IMG_LoadTexture(m_Renderer, "res/gfx/coinEmpty.png");
    m_LevelCompleteSound = Mix_LoadWAV("res/sfx/levelComplete.ogg");
    if (m_LevelCompleteSound == nullptr) {
        std::cerr << "Failed to load levelComplete.ogg! " << SDL_GetError() << '\n';
    }
    m_PracticeMusic = Mix_LoadMUS("res/sfx/practice.ogg");
    if (m_PracticeMusic == nullptr) {
        std::cerr << "Failed to load practice.ogg! " << SDL_GetError() << '\n';
    }
    int resumeWidth = 0;
    int resumeHeight = 0;
    int exitWidth = 0;
    int exitHeight = 0;
    int practiceWidth = 0;
    int practiceHeight = 0;
    int pauseWidth = 0;
    int pauseHeight = 0;
    int placeCheckpointWidth = 0;
    int placeCheckpointHeight = 0;
    int removeCheckpointWidth = 0;
    int removeCheckpointHeight = 0;
    SDL_QueryTexture(m_ResumeTexture, NULL, NULL, &resumeWidth, &resumeHeight);
    SDL_QueryTexture(m_ExitTexture, NULL, NULL, &exitWidth, &exitHeight);
    SDL_QueryTexture(m_EnterPracticeTexture, NULL, NULL, &practiceWidth, &practiceHeight);
    SDL_QueryTexture(m_PauseTexture, NULL, NULL, &pauseWidth, &pauseHeight);
    SDL_QueryTexture(m_PlaceCheckpointTexture, NULL, NULL, &placeCheckpointWidth, &placeCheckpointHeight);
    SDL_QueryTexture(m_RemoveCheckpointTexture, NULL, NULL, &removeCheckpointWidth, &removeCheckpointHeight);
    const int width = m_Game->getWidth();
    const int height = m_Game->getHeight();
    const int xButtons = width/2 - (practiceWidth + MARGIN + resumeWidth + MARGIN + exitWidth)/2;
    const int practiceX = xButtons;
    const int resumeX = xButtons + practiceWidth + MARGIN;
    const int exitX = resumeX + resumeWidth + MARGIN;
    const int checkpointButtonsX = width/2 - (placeCheckpointWidth + MARGIN + removeCheckpointWidth) / 2;
    m_EnterPracticeButton.init(m_Game, m_EnterPracticeTexture, practiceX, height/2, practiceWidth, practiceHeight, false, true);
    m_ExitPracticeButton.init(m_Game, m_ExitPracticeTexture, practiceX, height/2, practiceWidth, practiceHeight, false, true);
    m_ResumeButton.init(m_Game, m_ResumeTexture, resumeX, height/2, resumeWidth, resumeHeight, false, true);
    m_ExitButton.init(m_Game, m_ExitTexture, exitX, height/2, exitWidth, exitHeight, false, true);
    m_PauseButton.init(m_Game, m_PauseTexture, width - pauseWidth - 20, 20, pauseWidth, pauseHeight);
    m_PlaceCheckpointButton.init(
        m_Game,
        m_PlaceCheckpointTexture,
        checkpointButtonsX,
        height - MARGIN - placeCheckpointHeight,
        placeCheckpointWidth,
        placeCheckpointHeight
    );
    m_RemoveCheckpointButton.init(
        m_Game,
        m_RemoveCheckpointTexture,
        checkpointButtonsX + MARGIN + placeCheckpointWidth,
        height - MARGIN - removeCheckpointHeight,
        removeCheckpointWidth,
        removeCheckpointHeight
    );
    m_MinY = m_Game->getHeight() - Ground::DEFAULT_HEIGHT - BLOCK_HEIGHT_LIMIT;
}

void PlayingState::destroy() {
    if (m_Song != nullptr) {
        Mix_FreeMusic(m_Song);
    }
    SDL_DestroyTexture(m_LevelEndBlockTexture);
    SDL_DestroyTexture(m_ResumeTexture);
    SDL_DestroyTexture(m_ExitTexture);
    SDL_DestroyTexture(m_EnterPracticeTexture);
    SDL_DestroyTexture(m_ExitPracticeTexture);
    SDL_DestroyTexture(m_PauseTexture);
    SDL_DestroyTexture(m_PlaceCheckpointTexture);
    SDL_DestroyTexture(m_RemoveCheckpointTexture);
    SDL_DestroyTexture(m_NewBestTexture);
    SDL_DestroyTexture(m_LevelPercentTexture);
    SDL_DestroyTexture(m_LevelCompleteTextTexture);
    SDL_DestroyTexture(m_LoadingTexture);
    SDL_DestroyTexture(m_CoinTexture);
    SDL_DestroyTexture(m_CoinEmptyTexture);
    Mix_FreeChunk(m_LevelCompleteSound);
    Mix_FreeMusic(m_PracticeMusic);
}

void PlayingState::enter() {
    m_Level = LevelSelect::get().getLevelSelected();
    m_SongIndex = m_Level < Config::LEVEL_COUNT ? m_Level : m_CustomSong;
#ifdef __EMSCRIPTEN__
    // The page downloads the song into the virtual file system while the level starts.
    EM_ASM({ if (Module.classicPrepareSong) Module.classicPrepareSong($0); }, m_SongIndex);
#endif
    m_IsInPractice = false;
    updateLevelCompleteTextTexture();
    Mix_HaltMusic();
    m_Player.reset();
    m_LevelManager.reset(m_Level);
    m_InitialBackground = m_LevelManager.getInitialBackground();
    m_InitialGround = m_LevelManager.getInitialGround();
    m_Game->getBackground().fade(m_InitialBackground.r, m_InitialBackground.g, m_InitialBackground.b, 0);
    m_Game->getGround().fade(m_InitialGround.r, m_InitialGround.g, m_InitialGround.b, 0);
    m_Game->getGround().setPosition({ 0, static_cast<float>(Config::FLOOR_Y) });
    m_Game->getGround().setBounds(false, 0, 0);
    m_Game->setCameraPosition({0, 0});
    const int exitX = m_Game->getWidth()/2 + (m_EnterPracticeButton.getW() + MARGIN + m_ResumeButton.getW() + MARGIN - m_ExitButton.getW())/2;
    m_ExitButton.setPosition(exitX, m_Game->getHeight()/2, false, true);
    m_LevelBeginTimer = 60;
    m_SongWaitTime = 0;
    m_SongMissing = false;
    m_IsTimerFinished = false;
    m_IsSongPlaying = false;
    m_IsPlayerDead = false;
    m_IsEscapeHeld = false;
    m_IsSpaceHeld = false;
    m_IsZHeld = false;
    m_IsXHeld = false;
    m_IsPaused = false;
    m_ShouldEndLevel = false;
    m_LevelEndBlocksX = m_LevelManager.getFurthestX() - 7*Config::TILE_SIZE/2 + m_Game->getWidth();
    m_TimeEndingLevel = 0;
    m_IsLevelComplete = false;
    m_JustSetNewBest = false;
    m_LevelPercent = 0;
    updateLevelPercentTexture();
}

void PlayingState::exit() {
    resetMusic();
    if (m_Song != nullptr) {
        Mix_FreeMusic(m_Song);
        m_Song = nullptr;
    }
    m_Game->restartMenuLoop();
    m_Game->setCameraPosition({0, 0});
    m_Game->getGround().setBounds(false, 0, 0);
#ifdef __EMSCRIPTEN__
    EM_ASM({ if (Module.classicOnLevelExit) Module.classicOnLevelExit($0); }, m_Level);
#endif
}

bool PlayingState::prepareSong() {
    if (m_Song != nullptr || m_SongMissing) {
        return true;
    }
    std::ifstream file(songPath(m_SongIndex));
    if (!file.good()) {
        return false;
    }
    file.close();
    m_Song = Mix_LoadMUS(songPath(m_SongIndex).c_str());
    if (m_Song == nullptr) {
        std::cerr << "Failed to load song " << m_SongIndex << "! " << SDL_GetError() << '\n';
        m_SongMissing = true;
    }
    return true;
}

void PlayingState::startSong() {
    if (m_Song != nullptr) {
        Mix_PlayMusic(m_Song, 0);
    }
}

void PlayingState::update(float deltaTime) {
    int newLevelPercent = static_cast<int>(10000 * m_Player.getPosition().x / m_LevelEndBlocksX);
    newLevelPercent = std::clamp(newLevelPercent, 0, 10000);
    // optimization so it doesn't recreate text texture every frame
    if (newLevelPercent != m_LevelPercent) {
        m_LevelPercent = newLevelPercent;
        updateLevelPercentTexture();
    }

    const bool isEscapeHeld = m_Game->isEscapeHeld();
    const bool isEscapeReleased = m_IsEscapeHeld && !isEscapeHeld;
    m_IsEscapeHeld = isEscapeHeld;

    if (m_IsLevelComplete) {
        updateLevelComplete(isEscapeReleased);
        return;
    }
    if (m_ShouldEndLevel) {
        updateEndLevel(deltaTime);
        return;
    }
    if (m_IsPaused) {
        updatePause(isEscapeReleased);
        return;
    }
    m_PauseButton.update();
    if (isEscapeReleased || m_PauseButton.isPressed()) {
        pause();
        return;
    }

    Background &background = m_Game->getBackground();
    Ground &ground = m_Game->getGround();
    background.update(deltaTime);
    ground.update(deltaTime);

    if (m_IsInPractice) {
        bool zReleased = m_IsZHeld && !m_Game->isZHeld();
        bool xReleased = m_IsXHeld && !m_Game->isXHeld();
        m_IsZHeld = m_Game->isZHeld();
        m_IsXHeld = m_Game->isXHeld();
        m_PlaceCheckpointButton.update();
        if (zReleased || m_PlaceCheckpointButton.isPressed()) {
            m_Player.placeCheckpoint();
        }
        m_RemoveCheckpointButton.update();
        if (xReleased || m_RemoveCheckpointButton.isPressed()) {
            m_Player.removeCheckpoint();
        }
    }

    if (m_Game->getCameraPosition().x != 0) {
        background.setMoving(true);
    }

    if (!m_IsTimerFinished) {
        // Wait for the start countdown and for the song download, whichever is
        // longer, but never forever.
        m_LevelBeginTimer -= deltaTime;
        const bool songReady = prepareSong();
        if (!songReady) {
            m_SongWaitTime += deltaTime;
        }
        if (m_LevelBeginTimer > 0 || (!songReady && m_SongWaitTime < SONG_WAIT_LIMIT)) {
            return;
        }
        m_IsTimerFinished = true;
    }

    bool playerJustDied = !m_IsPlayerDead && m_Player.isDead();
    bool playerJustRevived = m_IsPlayerDead && !m_Player.isDead();
    m_IsPlayerDead = m_Player.isDead();

    if (playerJustDied) {
        updateNewBest();
    }

    if (!PlayingState::get().isInPractice() && (!m_IsSongPlaying || playerJustRevived)) {
        startSong();
        m_JustSetNewBest = false;
        m_IsSongPlaying = true;
    }
    m_Player.update(deltaTime);
    const std::pair<float, float> bounds = m_Player.getBounds();
    ground.setBounds(m_Player.hasBounds(), bounds.first, bounds.second);

    if (m_Player.getPosition().x > m_LevelManager.getFurthestX()) {
        m_ShouldEndLevel = true;
    }
}

void PlayingState::updatePause(bool isEscapeReleased) {
    m_ExitButton.update();
    if (m_ExitButton.isPressed() || isEscapeReleased) {
        m_Game->popState();
        return;
    }
    const bool isSpaceHeld = m_Game->isSpaceHeld();
    const bool spaceReleased = m_IsSpaceHeld && !isSpaceHeld;
    m_IsSpaceHeld = isSpaceHeld;

    m_ResumeButton.update();
    if (m_ResumeButton.isPressed() || spaceReleased) {
        resume();
    }
    if (m_IsInPractice) {
        m_ExitPracticeButton.update();
        if (m_ExitPracticeButton.isPressed()) {
            m_IsInPractice = false;
            m_Player.reset();
            m_Game->setCameraPosition({0, 0});
            m_Game->getBackground().fade(m_InitialBackground.r, m_InitialBackground.g, m_InitialBackground.b, 0);
            m_Game->getGround().fade(m_InitialGround.r, m_InitialGround.g, m_InitialGround.b, 0);
            resume();
            Mix_HaltMusic();
            m_IsSongPlaying = false;
            updateLevelCompleteTextTexture();
        }
    } else {
        m_EnterPracticeButton.update();
        if (m_EnterPracticeButton.isPressed()) {
            m_IsInPractice = true;
            m_Player.reset();
            m_Game->setCameraPosition({0, 0});
            m_Game->getBackground().fade(m_InitialBackground.r, m_InitialBackground.g, m_InitialBackground.b, 0);
            m_Game->getGround().fade(m_InitialGround.r, m_InitialGround.g, m_InitialGround.b, 0);
            resume();
            Mix_HaltMusic();
            Mix_PlayMusic(m_PracticeMusic, -1);
            updateLevelCompleteTextTexture();
        }
    }
}

void PlayingState::updateEndLevel(float deltaTime) {
    m_TimeEndingLevel += deltaTime;
    // i just made this up lmao
    constexpr float CAM_SPEED = 1.8f;
    const float xAdder = m_TimeEndingLevel / 9.0f;
    m_Player.moveX(xAdder * deltaTime);
    m_Game->setCameraX(m_Game->getCameraPosition().x + CAM_SPEED * deltaTime);
    if (m_Player.getPosition().x > m_LevelEndBlocksX) {
        m_IsLevelComplete = true;
        m_ShouldEndLevel = false;
        m_ExitButton.setPosition(m_Game->getWidth()/2, m_Game->getHeight()/2, true, true);
        Mix_PlayChannel(-1, m_LevelCompleteSound, 0);
        if (m_IsInPractice) {
            LevelSelect::get().setBestPracticePercentage(100);
        } else {
            LevelSelect::get().setBestPercentage(100);
            // coins only count when the level is finished without practice
            LevelSelect::get().saveCoins(m_Player.getCoins());
        }
    }
}

void PlayingState::updateLevelComplete(bool isEscapeReleased) {
    m_ExitButton.update();
    if (m_ExitButton.isPressed() || isEscapeReleased) {
        m_Game->popState();
    }
}

void PlayingState::updateNewBest() {
    LevelSelect &levelSelect = LevelSelect::get();
    if (m_IsInPractice) {
        int currentBest = levelSelect.getBestPracticePercentage();
        int possibleBest = m_LevelPercent / 100;
        if (possibleBest > currentBest) {
            levelSelect.setBestPracticePercentage(possibleBest);
            m_JustSetNewBest = true;
        }
    } else {
        int currentBest = levelSelect.getBestPercentage();
        int possibleBest = m_LevelPercent / 100;
        if (possibleBest > currentBest) {
            levelSelect.setBestPercentage(possibleBest);
            m_JustSetNewBest = true;
            updateNewBestTexture();
        }
    }
}

void PlayingState::render() const {
    m_LevelManager.render();
    // Keep the player in front of blocks and decorations. Drawing it first makes
    // the cube look like it slides behind obstacles while running into them.
    m_Player.render();
    renderEndBlocks();
    // render ground so it appears above blocks but below text
    m_Game->getGround().render();
    m_PauseButton.render();
    if (m_JustSetNewBest && !m_IsInPractice) {
        Text::renderTexture(m_Renderer, m_NewBestTexture, m_Game->getWidth()/2, m_Game->getHeight()/2, true, true);
    }
    Text::renderTexture(m_Renderer, m_LevelPercentTexture, m_Game->getWidth()/2, 10, true, false, 0.5f);
    renderCoins();
    if (!m_IsTimerFinished && m_Song == nullptr && m_LevelBeginTimer <= 0) {
        Text::renderTexture(m_Renderer, m_LoadingTexture, m_Game->getWidth()/2, m_Game->getHeight()/3, true, true, 0.6f);
    }
    if (m_IsInPractice) {
        m_PlaceCheckpointButton.render();
        m_RemoveCheckpointButton.render();
    }
    if (m_IsPaused) {
        renderPause();
    }
    if (m_IsLevelComplete) {
        renderLevelCompleteMenu();
    }
}

void PlayingState::renderPause() const {
    const SDL_Rect screen = { 0, 0, m_Game->getWidth(), m_Game->getHeight() };
    SDL_SetRenderDrawColor(m_Renderer, 0, 0, 0, 100);
    SDL_SetRenderDrawBlendMode(m_Renderer, SDL_BLENDMODE_BLEND);
    SDL_RenderFillRect(m_Renderer, &screen);
    Text::renderTexture(m_Renderer, LevelSelect::get().getLevelNameTexture(), m_Game->getWidth()/2, 230, true, true);
    if (m_IsInPractice) {
        m_ExitPracticeButton.render();
    } else {
        m_EnterPracticeButton.render();
    }
    m_ResumeButton.render();
    m_ExitButton.render();
}

void PlayingState::renderEndBlocks() const {
    SDL_Rect dst = {
        m_LevelEndBlocksX - static_cast<int>(m_Game->getCameraPosition().x),
        m_MinY - static_cast<int>(m_Game->getCameraPosition().y),
        Config::TILE_SIZE,
        Config::TILE_SIZE
    };
    for (int i = 0; i < BLOCK_HEIGHT_LIMIT; i += Config::TILE_SIZE) {
        SDL_RenderCopyEx(m_Renderer, m_LevelEndBlockTexture, NULL, &dst, -90.0, NULL, SDL_FLIP_NONE);
        dst.y += Config::TILE_SIZE;
    }
}

void PlayingState::renderCoins() const {
    // top left: coins of this run, faint ones were kept from earlier runs
    const int count = m_LevelManager.getCoinCount();
    const int saved = m_Level < Config::LEVEL_COUNT ? LevelSelect::get().getSavedCoins() : 0;
    for (int i = 0; i < count; i++) {
        const SDL_Rect coin = { 24 + i * 70, 20, 60, 60 };
        if (m_Player.hasCoin(i)) {
            SDL_SetTextureAlphaMod(m_CoinTexture, 255);
            SDL_RenderCopy(m_Renderer, m_CoinTexture, NULL, &coin);
        } else if ((saved >> i) & 1) {
            SDL_SetTextureAlphaMod(m_CoinTexture, 110);
            SDL_RenderCopy(m_Renderer, m_CoinTexture, NULL, &coin);
            SDL_SetTextureAlphaMod(m_CoinTexture, 255);
        } else {
            SDL_RenderCopy(m_Renderer, m_CoinEmptyTexture, NULL, &coin);
        }
    }
}

void PlayingState::renderLevelCompleteMenu() const {
    Text::renderTexture(m_Renderer, m_LevelCompleteTextTexture, m_Game->getWidth()/2, m_Game->getHeight()/4, true, true);
    m_ExitButton.render();
}

void PlayingState::pause() {
    m_IsPaused = true;
    Mix_PauseMusic();
}

void PlayingState::resume() {
    m_IsPaused = false;
    Mix_ResumeMusic();
}

void PlayingState::resetMusic() {
    Mix_HaltMusic();
}

void PlayingState::attemptResetTimer() {
    if (m_IsTimerFinished) {
        return;
    }
    m_LevelBeginTimer = 60;
}

void PlayingState::updateNewBestTexture() {
    SDL_DestroyTexture(m_NewBestTexture);
    m_NewBestTexture = Text::createTexture(m_Renderer, "New Best! " + std::to_string(m_LevelPercent/100) + "%");
}

void PlayingState::updateLevelPercentTexture() {
    SDL_DestroyTexture(m_LevelPercentTexture);
    const int hundredths = m_LevelPercent % 100;
    m_LevelPercentTexture = Text::createTexture(
        m_Renderer,
        std::to_string(m_LevelPercent/100) + "." + (hundredths < 10 ? "0" : "") + std::to_string(hundredths) + "%"
    );
}

void PlayingState::updateLevelCompleteTextTexture() {
    SDL_DestroyTexture(m_LevelCompleteTextTexture);
    if (m_IsInPractice) {
        m_LevelCompleteTextTexture = Text::createTexture(m_Renderer, "Practice Complete!");
    } else {
        m_LevelCompleteTextTexture = Text::createTexture(m_Renderer, "Level Complete!");
    }
}

bool PlayingState::playerShouldIgnoreMouseClicks() const {
    return m_PauseButton.mouseIntersects() || m_PlaceCheckpointButton.mouseIntersects() || m_RemoveCheckpointButton.mouseIntersects();
}

int PlayingState::simLoad(int level) {
    m_Level = level;
    m_IsInPractice = false;
    m_Player.reset();
    m_LevelManager.reset(level);
    return static_cast<int>(m_LevelManager.getObjects().size());
}

int PlayingState::simStep(bool held, float deltaTime) {
    m_Player.simUpdate(held, deltaTime);
    if (m_Player.isDead()) {
        return 1;
    }
    if (m_Player.getPosition().x > m_LevelManager.getFurthestX()) {
        return 2;
    }
    return 0;
}
