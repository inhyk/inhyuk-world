"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { games, getGameBySlug } from "@/data/games";
import { Icon } from "@/components/ui/Icon";

const spotlightGames = [
  "orbit-breaker",
  "valorant-protocol",
  "undertale-fan-game",
]
  .map(getGameBySlug)
  .filter((game) => game !== undefined);
const genreCount = new Set(games.map((game) => game.category)).size;

export function HomeHero() {
  const router = useRouter();

  function pickRandomGame() {
    const playableGames = games.filter((game) => game.playUrl);
    const game =
      playableGames[Math.floor(Math.random() * playableGames.length)];
    if (game) router.push(`/games/${game.slug}`);
  }

  return (
    <section className="home-hero" aria-labelledby="hero-title">
      <div className="site-container">
        <div className="hero-topline mono-label">
          <span>
            <span className="status-dot" /> A LITTLE CREATOR. A WHOLE NEW WORLD.
          </span>
          <span className="hidden sm:block">
            INDEPENDENT GAME LAB · EST. 2025
          </span>
        </div>
        <div className="hero-composition">
          <div className="hero-copy">
            <p className="hero-eyebrow">
              <span>상상력으로 만드는 작은 우주</span>
              <Icon name="spark" width="16" height="16" />
            </p>
            <h1 id="hero-title">
              작은 상상,
              <br />
              <span>무한한 플레이.</span>
            </h1>
            <p className="hero-description">
              만들고 싶은 건 뭐든, 해보고 싶은 건 전부.
              <br />
              초등학생 개발자 인혁이 만든 세계에 놀러 오세요.
            </p>
            <div className="hero-actions">
              <a href="#games" className="action-button action-primary">
                게임 탐험하기
                <Icon name="arrow-up" />
              </a>
              <button
                type="button"
                onClick={pickRandomGame}
                className="action-button action-quiet"
              >
                <Icon name="shuffle" width="17" height="17" />
                랜덤으로 골라보기
              </button>
            </div>
            <div className="hero-facts">
              <div>
                <strong>
                  {String(games.length).padStart(2, "0")}
                  <span>+</span>
                </strong>
                <span>직접 만든 게임</span>
              </div>
              <div>
                <strong>{String(genreCount).padStart(2, "0")}</strong>
                <span>서로 다른 장르</span>
              </div>
              <div className="hero-fact-note">
                <span className="status-dot" />
                <span>설치 없이, 바로 플레이</span>
              </div>
            </div>
          </div>
          <div className="hero-artwork">
            <span className="hero-orbit" aria-hidden="true" />
            <span className="hero-art-word" aria-hidden="true">
              PLAY
            </span>
            <div className="hero-art-float">
              <Image
                src="/images/world-console.png"
                alt="작은 초록빛 게임 세계를 품은 게임기와 그 주위를 도는 은빛 궤도"
                fill
                sizes="(max-width: 767px) 100vw, 650px"
                priority
                className="object-contain"
              />
            </div>
            <div className="art-label art-label-top">
              <span className="status-dot" /> IMAGINATION, LOADING…
            </div>
            <div className="art-label art-label-bottom">
              <span className="art-cross">+</span>
              <span>
                BUILT WITH CURIOSITY.
                <br />
                MADE TO BE PLAYED.
              </span>
            </div>
            <div className="hero-sticker" aria-hidden="true">
              <Icon name="spark" width="28" height="28" />
              <span>
                100%
                <br />
                상상력 충전
              </span>
            </div>
          </div>
        </div>
        <div className="spotlight-heading">
          <span className="mono-label">FRESH FROM THE LAB</span>
          <span>
            새로 열린 세계들
            <Icon name="arrow" width="15" height="15" />
          </span>
        </div>
        <div className="spotlight-grid">
          {spotlightGames.map((game, index) => (
            <Link
              className="spotlight-card"
              href={`/games/${game.slug}`}
              key={game.slug}
            >
              <div className="spotlight-image">
                <Image
                  src={game.thumbnail}
                  alt=""
                  fill
                  sizes="100px"
                  className="object-cover"
                />
              </div>
              <div className="spotlight-copy">
                <span className="mono-label">
                  0{index + 1} / {game.category}
                </span>
                <h2>{game.title.split(/ · | \/\/ /)[0]}</h2>
                <span className="spotlight-caption">게임 만나보기</span>
              </div>
              <Icon name="arrow-up" className="spotlight-arrow" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
