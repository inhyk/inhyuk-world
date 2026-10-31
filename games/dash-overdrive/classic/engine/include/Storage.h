#pragma once

// Small integers saved in the browser's localStorage under "dash-classic:<key>".
// Keys are numbers so no strings cross the JavaScript boundary.
namespace Storage {

constexpr int SKIN = 1;
constexpr int BEST = 100;          // + level
constexpr int BEST_PRACTICE = 200; // + level

int getInt(int key, int fallback);
void setInt(int key, int value);

}
