#pragma once

namespace Config {

constexpr int LEVEL_COUNT = 18;
// The last three levels are secret: they open with coins.
constexpr int SECRET_FIRST = 15;
constexpr int SECRET_COINS[3] = { 10, 20, 30 };
// The map maker writes its level into this extra slot after the built-in ones.
constexpr int CUSTOM_LEVEL = LEVEL_COUNT;
constexpr int SLOT_COUNT = LEVEL_COUNT + 1;
constexpr int SKIN_COUNT = 12;
constexpr int TILE_SIZE = 120;
constexpr int HEIGHT = 1296; // Height is constant, width changes depending on aspect ratio
constexpr int FLOOR_Y = HEIGHT - 3 * TILE_SIZE;

}
