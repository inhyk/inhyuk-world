#pragma once

namespace Config {

constexpr int LEVEL_COUNT = 20;
// Levels 16-20 are secret: they open with coins.
constexpr int SECRET_FIRST = 15;
constexpr int SECRET_COINS[5] = { 10, 20, 30, 40, 50 };
// The map maker writes its level into this extra slot after the built-in ones.
constexpr int CUSTOM_LEVEL = LEVEL_COUNT;
constexpr int SLOT_COUNT = LEVEL_COUNT + 1;
constexpr int SKIN_COUNT = 24;
// The first skins are free; finishing level N unlocks skin FREE_SKINS + N - 1.
constexpr int FREE_SKINS = 4;
constexpr int TILE_SIZE = 120;
constexpr int HEIGHT = 1296; // Height is constant, width changes depending on aspect ratio
constexpr int FLOOR_Y = HEIGHT - 3 * TILE_SIZE;

}
