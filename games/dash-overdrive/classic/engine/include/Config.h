#pragma once

namespace Config {

constexpr int LEVEL_COUNT = 15;
// The map maker writes its level into this extra slot after the built-in ones.
constexpr int CUSTOM_LEVEL = LEVEL_COUNT;
constexpr int SLOT_COUNT = LEVEL_COUNT + 1;
constexpr int SKIN_COUNT = 12;
constexpr int TILE_SIZE = 120;
constexpr int HEIGHT = 1296; // Height is constant, width changes depending on aspect ratio
constexpr int FLOOR_Y = HEIGHT - 3 * TILE_SIZE;

}
