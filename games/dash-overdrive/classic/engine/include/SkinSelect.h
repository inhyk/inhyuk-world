#pragma once
#include "GameState.h"
#include "Button.h"
#include "Config.h"
#include <array>
#include <SDL.h>

class Game;

class SkinSelect : public GameState {
public:
    void init(Game *game) override;
    void destroy() override;
    void enter() override;
    void exit() override;
    void update(float deltaTime) override;
    void render() const override;
    inline static SkinSelect &get() { return m_SkinSelect; }

private:
    static SkinSelect m_SkinSelect;
    static constexpr int COLUMNS = 6;
    static constexpr int SLOT_SIZE = 180;
    static constexpr int SLOT_GAP = 46;
    SDL_Texture *m_SlotTexture;
    SDL_Texture *m_SelectedTexture;
    SDL_Texture *m_BackTexture;
    SDL_Texture *m_HeadingTexture;
    Button m_BackButton;
    std::array<Button, Config::SKIN_COUNT> m_SlotButtons;
    float m_Time = 0;
    bool m_IsEscapeHeld;
};
