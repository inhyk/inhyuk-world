"use client";

import { useMemo, useState } from "react";
import { games } from "@/data/games";
import { GameCard } from "@/components/games/GameCard";
import { HomeHero } from "@/components/home/HomeHero";
import { Icon } from "@/components/ui/Icon";

const ALL = "전체";
const categories = [
  ALL,
  ...Array.from(new Set(games.map((game) => game.category))),
];
const PAGE_SIZE = 8;

interface GameExplorerProps {
  title?: string;
  description?: string;
  showVideoHero?: boolean;
}

export function GameExplorer({
  title = "모든 게임",
  description,
  showVideoHero = true,
}: GameExplorerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);
  const [sort, setSort] = useState("recent");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = games.filter((game) => {
      if (category !== ALL && game.category !== category) return false;
      return (
        !q ||
        [game.title, game.description, game.category, ...game.techStack]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    });
    return sort === "name"
      ? result.sort((a, b) => a.title.localeCompare(b.title, "ko"))
      : result;
  }, [query, category, sort]);

  const visibleGames = showVideoHero
    ? filtered.slice(0, visibleCount)
    : filtered;

  function resetFilters() {
    setQuery("");
    setCategory(ALL);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <>
      {showVideoHero ? (
        <HomeHero />
      ) : (
        <header className="collection-hero site-container">
          <p className="section-kicker">
            <span>THE GAME COLLECTION</span>
            <Icon name="spark" width="16" height="16" />
          </p>
          <h1>
            {title}
            <span className="text-brand">.</span>
          </h1>
          <p>
            {description ??
              "작은 아이디어에서 시작된, 저마다 다른 세계를 만나보세요."}
          </p>
        </header>
      )}
      <section
        id="games"
        className="game-collection site-container"
        aria-labelledby="collection-title"
      >
        <div className="section-heading">
          <div>
            <p className="section-kicker">
              <span className="section-number">01 /</span> PICK YOUR NEXT
              ADVENTURE
            </p>
            <h2 id="collection-title">
              오늘은 어떤 세계로 갈까요?
              <span className="count-tag">{games.length}</span>
            </h2>
          </div>
          <div className="game-search">
            <Icon name="search" width="18" height="18" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="어떤 게임을 찾고 있나요?"
              aria-label="게임 검색"
            />
            {query && (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={() => {
                  setQuery("");
                  setVisibleCount(PAGE_SIZE);
                }}
              >
                <Icon name="close" width="16" height="16" />
              </button>
            )}
          </div>
        </div>
        <div className="collection-toolbar">
          <div
            className="category-list no-scrollbar"
            role="group"
            aria-label="게임 카테고리 필터"
          >
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategory(cat);
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-pressed={cat === category}
                className={`category-chip ${
                  cat === category ? "is-active" : ""
                }`}
              >
                {cat === ALL && <Icon name="grid" width="14" height="14" />}
                {cat}
              </button>
            ))}
          </div>
          <label className="sort-control">
            <span className="sr-only">게임 정렬</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <option value="recent">최근 업데이트순</option>
              <option value="name">이름순</option>
            </select>
            <Icon name="chevron" width="14" height="14" />
          </label>
        </div>
        <p className="sr-only" role="status">
          검색 결과 {filtered.length}개의 게임이 있습니다. 현재{" "}
          {visibleGames.length}개를 표시합니다.
        </p>
        {visibleGames.length > 0 ? (
          <div className="game-grid">
            {visibleGames.map((game, index) => (
              <GameCard key={game.slug} game={game} index={index} />
            ))}
          </div>
        ) : (
          <div className="games-empty">
            <Icon name="search" width="32" height="32" />
            <h3>아직 발견하지 못한 세계네요</h3>
            <p>다른 이름이나 장르로 다시 찾아보세요.</p>
            <button
              type="button"
              className="action-button action-outline"
              onClick={resetFilters}
            >
              전체 게임 보기
              <Icon name="arrow" />
            </button>
          </div>
        )}
        {showVideoHero && visibleCount < filtered.length && (
          <div className="collection-more">
            <span className="mono-label">
              {String(visibleGames.length).padStart(2, "0")} / {filtered.length}{" "}
              WORLDS EXPLORED
            </span>
            <button
              type="button"
              className="action-button action-outline"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            >
              더 많은 게임 만나보기
              <Icon name="chevron" width="16" height="16" />
            </button>
          </div>
        )}
      </section>
    </>
  );
}
