#include "LevelManager.h"
#include "Game.h"
#include "LevelSelect.h"
#include "PlayingState.h"
#include <SDL_image.h>
#include <fstream>
#include <cstdlib>
#include "Util.h"
#include <iostream>
#include <algorithm>

namespace {
// Map maker levels come from the browser, so a bad number must not abort the game.
float toFloat(const std::string &text) {
    return std::strtof(text.c_str(), nullptr);
}

int toInt(const std::string &text) {
    return static_cast<int>(std::strtol(text.c_str(), nullptr, 10));
}
}

void LevelManager::init(Game *game) {
    m_Game = game;
    initBlocks();
    loadTextures();
}

void LevelManager::initBlocks() {
    // i found hitbox values in the gd programming discord
    for (int i = 1; i <= 7; i++) {
        if (i == 5) continue;
        m_IDToObjectData[i] = {
            .type = ObjectType::BLOCK,
            .hitbox = SDL_FRect { 0, 0, static_cast<float>(Config::TILE_SIZE), static_cast<float>(Config::TILE_SIZE) }
        };
    }
    m_IDToObjectData[5].type = ObjectType::DECO;
    m_IDToObjectData[8] = {
        ObjectType::HAZARD,
        SDL_FRect { 48, 36, 24, 48 },
    };
    m_IDToObjectData[9] = {
        ObjectType::HAZARD,
        SDL_FRect { 42, 30.4f, 36, 43.2f }
    };
    m_IDToObjectData[10] = {
        ObjectType::NORMAL_PORTAL,
        SDL_FRect { 10, -4, 100, 300 }
    };
    m_IDToObjectData[11] = m_IDToObjectData[10];
    m_IDToObjectData[11].type = ObjectType::UPSIDE_DOWN_PORTAL;
    m_IDToObjectData[12] = {
        ObjectType::CUBE_PORTAL,
        SDL_FRect { -4, -4, 136, 344 }
    };
    m_IDToObjectData[13] = m_IDToObjectData[12];
    m_IDToObjectData[13].type = ObjectType::SHIP_PORTAL;
    for (int i = 15; i <= 21; i++) {
        m_IDToObjectData[i].type = ObjectType::DECO;
    }
    m_IDToObjectData[29].type = ObjectType::BG_TRIGGER;
    m_IDToObjectData[30].type = ObjectType::G_TRIGGER;
    m_IDToObjectData[35] = {
        ObjectType::PAD,
        SDL_FRect { -10, 0, 100, 16 },
    };
    m_IDToObjectData[36] = {
        ObjectType::ORB,
        SDL_FRect { -12, -12, 144, 144 },
    };
    m_IDToObjectData[39] = {
        ObjectType::HAZARD,
        SDL_FRect { 48, 15.8f, 24, 22.4f },
    };
    m_IDToObjectData[40] = {
        ObjectType::BLOCK,
        SDL_FRect { 0, 0, 120, 54 },
    };
    m_IDToObjectData[41].type = ObjectType::DECO;
    // collectible coin, three in every built-in level
    m_IDToObjectData[201] = {
        ObjectType::COIN,
        SDL_FRect { 20, 20, 80, 80 },
    };
}

void LevelManager::reset(int level) {
    m_FurthestX = 0;
    clearObjects();
    loadLevelData(level);
}

LevelManager::~LevelManager() {
    for (auto &[_, data] : m_IDToObjectData) {
        // SDL_DestroyTexture checks if texture is null i believe
        SDL_DestroyTexture(data.texture);
    }
}

const std::vector<Object> &LevelManager::getObjects() const {
    return m_Objects;
}

std::vector<Trigger> &LevelManager::getTriggers() {
    return m_Triggers;
}

std::size_t LevelManager::firstCollidableFrom(float x) const {
    const auto first = std::lower_bound(m_Collidables.begin(), m_Collidables.end(), x, [](const Object *object, float value) {
        return object->getHitbox()->x < value;
    });
    return static_cast<std::size_t>(first - m_Collidables.begin());
}

int LevelManager::indexOf(const Object *object) const {
    return static_cast<int>(object - m_Objects.data());
}

SDL_Color LevelManager::getInitialBackground() const {
    return m_InitialBackgroundColor;
}

SDL_Color LevelManager::getInitialGround() const {
    return m_InitialGroundColor;
}

void LevelManager::clearObjects() {
    m_Objects.clear();
    m_Collidables.clear();
    m_Triggers.clear();
}

SDL_FRect LevelManager::rotateHitbox(SDL_FRect hitbox, int rotations) {
    if (rotations == 0) {
        return hitbox;
    }
    while (rotations < 0) {
        rotations += 4;
    }
    SDL_FRect rotated = hitbox;
    SDL_FPoint center = {rotated.x + rotated.w/2, rotated.y + rotated.h/2};
    rotated.x -= center.x;
    rotated.y -= center.y;
    for (int i = 0; i < rotations; i++) {
        float newX = -rotated.y - rotated.h;
        float newY = rotated.x;
        rotated.x = newX;
        rotated.y = newY;
        std::swap(rotated.w, rotated.h);
    }
    rotated.x += center.x;
    rotated.y += center.y;
    return rotated;
}

void LevelManager::loadTextures() {
    for (auto &[id, data] : m_IDToObjectData) {
        if (data.type == ObjectType::BG_TRIGGER || data.type == ObjectType::G_TRIGGER) {
            continue;
        }
        data.texture = IMG_LoadTexture(m_Game->getRenderer(), ("res/gfx/objects/" + std::to_string(id) + ".png").c_str());
        if (data.texture == nullptr) {
            std::cerr << "Failed to load " << id << ".png! " << SDL_GetError() << '\n';
            continue;
        }
        SDL_QueryTexture(data.texture, NULL, NULL, &data.width, &data.height);
    }
}

void LevelManager::loadLevelData(int level) {
    m_FurthestX = 0;
    m_CoinCount = 0;
    m_InitialBackgroundColor = { 40, 125, 255, 255 };
    m_InitialGroundColor = { 0, 102, 255, 255 };
    std::ifstream in("res/leveldata/" + std::to_string(level) + ".level");
    std::stringstream buffer;
    buffer << in.rdbuf();
    const std::string levelData = buffer.str();
    std::vector<std::string> objectProperties = Util::splitString(levelData, ';');
    if (objectProperties.empty()) {
        return;
    }

    // read initial properties from before the level starts
    setInitialProperties(objectProperties[0]);
    objectProperties.erase(objectProperties.begin());

    for (const std::string &properties : objectProperties) {
        addObject(properties);
    }

    // Number the first three coins from left to right.
    std::vector<Object *> coins;
    for (Object &object : m_Objects) {
        if (object.getType() == ObjectType::COIN) {
            coins.push_back(&object);
        }
    }
    std::stable_sort(coins.begin(), coins.end(), [](const Object *a, const Object *b) {
        return a->getPos().x < b->getPos().x;
    });
    for (std::size_t i = 0; i < coins.size() && i < 3; i++) {
        coins[i]->setCoinIndex(static_cast<int>(i));
    }
    m_CoinCount = static_cast<int>(std::min<std::size_t>(coins.size(), 3));

    // The objects vector is complete now, so pointers into it stay valid.
    for (const Object &object : m_Objects) {
        if (object.getHitbox().has_value()) {
            m_Collidables.push_back(&object);
        }
    }
    std::stable_sort(m_Collidables.begin(), m_Collidables.end(), [](const Object *a, const Object *b) {
        return a->getHitbox()->x < b->getHitbox()->x;
    });
}

void LevelManager::addObject(const std::string &properties) {
    const std::vector<std::string> splitProperties = Util::splitString(properties, ',');
    int objectID = 1;
    SDL_FPoint objectPos = { 0, 0 };
    ObjectData data = m_IDToObjectData[objectID];
    bool flipX = false;
    bool flipY = false;
    int rotation = 0;
    SDL_Color color = { 0, 0, 0, 255 };
    float duration = 0;
    // i'm just gonna assume id is always listed first cuz otherwise there's gonna be some issues
    // also i love gd cologne https://github.com/GDColon/GDBrowser/blob/master/misc/analysis/objectProperties.json
    for (std::size_t i = 0; i+1 < splitProperties.size(); i += 2) {
        const int propertyID = toInt(splitProperties[i]);
        const std::string &propertyValue = splitProperties[i+1];
        switch (propertyID) {
        case 1: // ID
            objectID = toInt(propertyValue);
            // if the object actually exists
            if (m_IDToObjectData.count(objectID) > 0) {
                data = m_IDToObjectData[objectID];
            } else {
                continue;
            }
            break;
        case 2: // x
            objectPos.x = toFloat(propertyValue)*4 - data.width/2;
            break;
        case 3: // y
            objectPos.y = Config::HEIGHT - 3*Config::TILE_SIZE - (toFloat(propertyValue)*4 + data.height/2) + data.offset.y;
            break;
        case 4: // flipX
            flipX = toInt(propertyValue) == 1;
            break;
        case 5: // flipY
            flipY = toInt(propertyValue) == 1;
            break;
        case 6: // rotation
            rotation = toInt(propertyValue) / 90;
            break;
        case 7: // red
            color.r = static_cast<uint8_t>(toInt(propertyValue));
            break;
        case 8: // green
            color.g = static_cast<uint8_t>(toInt(propertyValue));
            break;
        case 9: // blue
            color.b = static_cast<uint8_t>(toInt(propertyValue));
            break;
        case 10: // duration
            duration = toFloat(propertyValue);
            break;
        default:
            break;
        }
    }
    // if the object doesn't exist
    if (m_IDToObjectData.count(objectID) == 0) {
        return;
    }
    std::optional<SDL_FRect> hitbox = {};
    if (data.hitbox.has_value()) {
        SDL_FRect hitboxOffset = rotateHitbox(data.hitbox.value(), rotation);
        if (flipX) {
            hitboxOffset.x = data.width - hitboxOffset.x - hitboxOffset.w;
        }
        if (flipY) {
            hitboxOffset.y = data.height - hitboxOffset.y - hitboxOffset.h;
        }
        hitbox = {hitboxOffset.x + objectPos.x, hitboxOffset.y + objectPos.y, hitboxOffset.w, hitboxOffset.h};
    }
    // separate triggers
    if (data.type == ObjectType::BG_TRIGGER || data.type == ObjectType::G_TRIGGER) {
        m_Triggers.emplace_back(m_Game, data.type, objectPos, color, duration);
    } else {
        m_Objects.emplace_back(m_Game, data.type, rotation, objectPos, hitbox, flipX, flipY, data.texture);
        m_Objects.back().setSparkle(objectID >= 15 && objectID <= 17);
    }
    m_FurthestX = std::max(m_FurthestX, static_cast<int>(objectPos.x + data.width));
}

void LevelManager::setInitialProperties(const std::string &initialProperties) {
    const std::vector<std::string> splitInitialProperties = Util::splitString(initialProperties, ',');
    for (std::size_t i = 0; i+1 < splitInitialProperties.size(); i += 2) {
        const std::string &property = splitInitialProperties[i];
        const std::vector<std::string> channels = Util::splitString(splitInitialProperties[i+1], '_');
        if (channels.size() < 6) {
            continue;
        }
        // i love gd cologne https://github.com/GDColon/GDBrowser/blob/master/misc/analysis/initialProperties.json
        const SDL_Color color = {
            static_cast<uint8_t>(toInt(channels[1])),
            static_cast<uint8_t>(toInt(channels[3])),
            static_cast<uint8_t>(toInt(channels[5])),
            255
        };
        if (property == "kS29") {
            m_InitialBackgroundColor = color;
        } else if (property == "kS30") {
            m_InitialGroundColor = color;
        }
    }
}

void LevelManager::render() const {
    for (const Object &gameObject : m_Objects) {
        // don't render stuff you don't see
        if (gameObject.getPos().x + gameObject.getWidth() < m_Game->getCameraPosition().x ||
            gameObject.getPos().x > m_Game->getCameraPosition().x + m_Game->getWidth() ||
            gameObject.getPos().y + gameObject.getHeight() < m_Game->getCameraPosition().y ||
            gameObject.getPos().y > m_Game->getCameraPosition().y + m_Game->getHeight()) {

            continue;
        }
        // a coin taken in this run disappears
        if (gameObject.getCoinIndex() >= 0 && PlayingState::get().getPlayer().hasCoin(gameObject.getCoinIndex())) {
            continue;
        }
        gameObject.render();
        if (m_Game->isCreatorMode() && gameObject.getHitbox().has_value()) {
            const SDL_FRect box = gameObject.getHitbox().value();
            const SDL_FRect drawn = { box.x - m_Game->getCameraPosition().x, box.y - m_Game->getCameraPosition().y, box.w, box.h };
            SDL_Renderer *renderer = m_Game->getRenderer();
            SDL_SetRenderDrawBlendMode(renderer, SDL_BLENDMODE_BLEND);
            switch (gameObject.getType()) {
            case ObjectType::HAZARD: SDL_SetRenderDrawColor(renderer, 255, 30, 30, 120); break;
            case ObjectType::BLOCK: SDL_SetRenderDrawColor(renderer, 40, 150, 255, 60); break;
            default: SDL_SetRenderDrawColor(renderer, 90, 255, 120, 70); break;
            }
            SDL_RenderFillRectF(renderer, &drawn);
            // a 3 pixel outline so it shows at any screen size
            for (int i = 0; i < 3; i++) {
                const SDL_FRect edge = { drawn.x + i, drawn.y + i, drawn.w - 2 * i, drawn.h - 2 * i };
                SDL_RenderDrawRectF(renderer, &edge);
            }
        }
    }
}
