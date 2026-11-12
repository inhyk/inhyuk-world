#pragma once

namespace Config {

constexpr int LEVEL_COUNT = 110;
// Levels 16-20 are secret: they open with coins. Level 21 (DASH AND RUN) and
// levels 22-100 (the designer's plan 3) are open.
// DASH TOWER: ten floors after level 100. A floor opens when the floor below is
// cleared; key doors before 4F, 7F and 10F also need keys (a floor's three
// collectibles are keys).
constexpr int TOWER_FIRST = 100;
constexpr int TOWER_FLOORS = 10;
constexpr int TOWER_DOOR_FLOORS[3] = { 3, 6, 9 };
constexpr int TOWER_DOOR_KEYS[3] = { 4, 10, 18 };
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
// Clearing the tower's top floor gives the last skin.
constexpr int TOWER_SKIN = SHOP_FIRST + SHOP_SKINS;
constexpr int SKIN_COUNT = TOWER_SKIN + 1;
constexpr bool isTowerFloor(int level) { return level >= TOWER_FIRST && level < TOWER_FIRST + TOWER_FLOORS; }
constexpr int TILE_SIZE = 120;
constexpr int HEIGHT = 1296; // Height is constant, width changes depending on aspect ratio
constexpr int FLOOR_Y = HEIGHT - 3 * TILE_SIZE;

}
