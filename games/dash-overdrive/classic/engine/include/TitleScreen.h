#pragma once
#include "GameState.h"
#include "Button.h"
#include <SDL.h>
#include <vector>

class Game;

class TitleScreen : public GameState {
public:
    void init(Game *game) override;
    void destroy() override;
    void enter() override;
    void exit() override;
    void update(float deltaTime) override;
    void render() const override;
    inline static TitleScreen &get() { return m_TitleScreen; }

private:
    // One cube of the parade that runs along the floor behind the buttons.
    struct ParadeCube {
        int skin;
        float x;
        float y;
        float yVelocity;
        float rotation;
        float jumpTimer;
    };

    static TitleScreen m_TitleScreen;
    SDL_Rect m_TitleRect;
    SDL_Texture *m_TitleTexture;
    SDL_Texture *m_TitlePlayTexture;
    SDL_Texture *m_SkinsTexture;
    SDL_Texture *m_CreateTexture;
    SDL_Texture *m_SkinsLabelTexture;
    SDL_Texture *m_PlayLabelTexture;
    SDL_Texture *m_CreateLabelTexture;
    Button m_TitlePlay;
    Button m_SkinsButton;
    Button m_CreateButton;
    std::vector<ParadeCube> m_Parade;
    float m_SpawnTimer = 0;
    float m_Time = 0;
    int m_NextParadeSkin = 0;
    unsigned int m_Random = 12345;
    bool m_IsMouseHeld;
    bool m_IsEscapeHeld;
    bool m_IsSpaceHeld;

    float nextRandom();
    void updateParade(float deltaTime);
    void renderLabel(SDL_Texture *label, const Button &button) const;
};
