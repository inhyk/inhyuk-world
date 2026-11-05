#pragma once

namespace Config {

constexpr int LEVEL_COUNT = 100;
// Levels 16-20 are secret: they open with coins. Level 21 (DASH AND RUN) and
// levels 22-100 (the designer's plan 3) are open.
constexpr int SECRET_FIRST = 15;
constexpr int SECRET_COUNT = 5;
constexpr int SECRET_COINS[5] = { 10, 20, 30, 40, 50 };
// The map maker writes its level into this extra slot after the built-in ones.
constexpr int CUSTOM_LEVEL = LEVEL_COUNT;
constexpr int SLOT_COUNT = LEVEL_COUNT + 1;
// The first skins are free; finishing level N (1-21) unlocks skin FREE_SKINS + N - 1.
constexpr int FREE_SKINS = 4;
constexpr int LEVEL_SKINS = 21;
// The last skins are bought with diamonds on the page (plan 3, item 6).
constexpr int SHOP_FIRST = FREE_SKINS + LEVEL_SKINS;
constexpr int SHOP_SKINS = 6;
constexpr int SHOP_PRICE = 10;
constexpr int SKIN_COUNT = SHOP_FIRST + SHOP_SKINS;
constexpr int TILE_SIZE = 120;
constexpr int HEIGHT = 1296; // Height is constant, width changes depending on aspect ratio
constexpr int FLOOR_Y = HEIGHT - 3 * TILE_SIZE;

}
