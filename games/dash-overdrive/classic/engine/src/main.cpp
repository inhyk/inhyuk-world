#include "Game.h"
#include "LevelSelect.h"
#include "PlayingState.h"
#include "TitleScreen.h"
#include <vector>
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

static Game game;
static uint64_t currentTime = 0;
static uint64_t newTime = 0;
static uint64_t timer = 0;

void mainLoop() {
    if (!game.isGameRunning()) {
        game.quit();
#ifdef __EMSCRIPTEN__
        emscripten_cancel_main_loop();
#else
        exit(0);
#endif
    }
    newTime = SDL_GetTicks64();
    timer += newTime - currentTime;
    constexpr float interval = 1000.0f / 60.0f;
    float deltaTime = (newTime - currentTime) / interval;
    currentTime = newTime;
    // A hidden tab can come back after seconds; never jump through walls.
    if (deltaTime > 2.0f) {
        deltaTime = 2.0f;
    }
    game.handleEvents();
    game.update(deltaTime);
    game.render();
    game.incrementFrames();
    if (timer >= 1000) {
        game.updateFPS();
        timer -= 1000;
    }
}

// Functions the web page calls (see public/play/dash-overdrive/classic/launcher.js).
extern "C" {

#ifdef __EMSCRIPTEN__
#define CLASSIC_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define CLASSIC_EXPORT
#endif

// Starts a level from the page. Built-in levels return to level select when
// finished; the map maker level returns to the title screen.
CLASSIC_EXPORT void classic_start_level(int level) {
    game.popToRoot();
    LevelSelect::get().selectLevel(level);
    if (level < Config::LEVEL_COUNT) {
        game.pushState(LevelSelect::get());
        // a locked secret level stays on level select, showing its padlock
        if (LevelSelect::get().coinsNeeded(level) > 0) {
            return;
        }
    }
    game.pushState(PlayingState::get());
}

CLASSIC_EXPORT void classic_set_creator(int on) {
    game.setCreatorMode(on != 0);
    LevelSelect::get().selectLevel(LevelSelect::get().getLevelSelected());
}

// For screenshots: creator mode without the hitboxes and the CREATOR MODE label.
CLASSIC_EXPORT void classic_set_hitboxes(int on) {
    game.setShowHitboxes(on != 0);
}

CLASSIC_EXPORT int classic_creator() {
    return game.isCreatorMode() ? 1 : 0;
}

CLASSIC_EXPORT int classic_total_coins() {
    return LevelSelect::get().getTotalCoins();
}

CLASSIC_EXPORT void classic_set_custom_song(int song) {
    PlayingState::get().setCustomSong(song);
}

CLASSIC_EXPORT void classic_go_title() {
    game.popToRoot();
}

// 0 title, 1 level select, 2 playing, 3 skins
CLASSIC_EXPORT int classic_state() {
    return static_cast<int>(game.getState()->getType());
}

CLASSIC_EXPORT int classic_level() {
    return LevelSelect::get().getLevelSelected();
}

CLASSIC_EXPORT int classic_percent() {
    return PlayingState::get().getLevelPercent();
}

CLASSIC_EXPORT int classic_is_paused() {
    return PlayingState::get().isPaused() ? 1 : 0;
}

// Level checker. Loads res/leveldata/<level>.level and steps the real physics.
static std::vector<PlayerSimState> simSlots;

CLASSIC_EXPORT int sim_load(int level) {
    return PlayingState::get().simLoad(level);
}

// 0 running, 1 dead, 2 reached the end
CLASSIC_EXPORT int sim_step(int held, float deltaTime) {
    return PlayingState::get().simStep(held != 0, deltaTime);
}

CLASSIC_EXPORT void sim_save(int slot) {
    if (slot >= static_cast<int>(simSlots.size())) {
        simSlots.resize(slot + 1);
    }
    simSlots[slot] = PlayingState::get().getPlayer().saveSimState();
}

CLASSIC_EXPORT void sim_restore(int slot) {
    PlayingState::get().getPlayer().restoreSimState(simSlots[slot]);
}

CLASSIC_EXPORT float sim_x() { return PlayingState::get().getPlayer().getPosition().x; }
CLASSIC_EXPORT float sim_y() { return PlayingState::get().getPlayer().getPosition().y; }
CLASSIC_EXPORT float sim_vy() { return PlayingState::get().getPlayer().getYVelocity(); }
CLASSIC_EXPORT int sim_mode() { return PlayingState::get().getPlayer().getGamemode() == Gamemode::SHIP ? 1 : 0; }
CLASSIC_EXPORT int sim_gravity() { return PlayingState::get().getPlayer().getGravityMultiplier(); }
CLASSIC_EXPORT int sim_grounded() { return PlayingState::get().getPlayer().isGrounded() ? 1 : 0; }
CLASSIC_EXPORT int sim_end_x() { return PlayingState::get().getLevel().getFurthestX(); }

}

int main(int /*argc*/, char **/*argv*/) {
    if (game.init() != 0) {
        game.quit();
    }
#ifdef __EMSCRIPTEN__
    EM_ASM({ if (Module.classicReady) Module.classicReady(); });
    emscripten_set_main_loop(mainLoop, 0, 1);
#else
    while (true) {
        mainLoop();
    }
#endif
    return 0;
}
