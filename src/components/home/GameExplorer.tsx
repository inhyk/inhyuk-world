"use client";

import { useMemo, useState } from "react";
import { games } from "@/data/games";
import { GameCard } from "@/components/games/GameCard";

const ALL = "전체";

export function GameExplorer() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL);

  const categories = useMemo(
    () => [ALL, ...Array.from(new Set(games.map((g) => g.category)))],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((game) => {
      const matchesCategory = category === ALL || game.category === category;
      if (!matchesCategory) return false;
      if (!q) return true;
      const haystack = [
        game.title,
        game.description,
        game.category,
        ...game.techStack,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, category]);

  return (
    <>
      {/* ---------- 짧은 그라데이션 히어로 ---------- */}
      <section className="relative overflow-hidden">
        <div className="mesh absolute inset-0" />
        <div className="mesh mesh-drift absolute inset-0 opacity-70 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />

        <div className="relative mx-auto max-w-7xl px-5 pt-24 pb-12 text-center md:px-8 md:pt-28 md:pb-14">
          <h1 className="fade-up font-[family-name:var(--font-inter-tight)] text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.25)] md:text-[46px]">
            인혁이의 게임 월드
          </h1>

          <p
            className="fade-up mx-auto mt-3 max-w-md text-[15px] text-white/85"
            style={{ animationDelay: "80ms" }}
          >
            직접 만든 게임 {games.length}개, 바로 아래에서 골라 보세요
          </p>

          {/* 검색창 */}
          <div
            className="fade-up mx-auto mt-7 flex w-full max-w-lg items-center gap-2 rounded-2xl border border-white/25 bg-white/12 px-4 py-3 backdrop-blur-xl transition-colors focus-within:border-white/50"
            style={{ animationDelay: "160ms" }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 16 16"
              fill="none"
              className="shrink-0 text-white/70"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10.5 10.5L14 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="게임 이름이나 장르로 찾기"
              aria-label="게임 검색"
              className="w-full bg-transparent text-[15px] text-white placeholder:text-white/60 outline-none"
            />
          </div>
        </div>
      </section>

      {/* ---------- 게임 그리드 ---------- */}
      <section id="games" className="mx-auto max-w-7xl px-5 pt-8 pb-20 md:px-8 md:pt-10 md:pb-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-inter-tight)] text-[26px] font-bold tracking-[-0.025em] md:text-[32px]">
              게임 둘러보기
            </h2>
            <p className="mt-1 text-sm text-muted">
              카드를 누르면 게임 소개와 플레이 링크로 갑니다
            </p>
          </div>

          {/* 카테고리 칩 */}
          <div className="no-scrollbar -mx-5 flex w-full gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:w-auto md:px-0">
            {categories.map((cat) => {
              const active = cat === category;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "border-transparent bg-foreground text-[#08080b]"
                      : "border-border text-muted-strong hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((game, i) => (
              <GameCard key={game.slug} game={game} index={i} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-border bg-surface py-16 text-center">
            <p className="text-4xl">🔍</p>
            <p className="mt-4 font-[family-name:var(--font-inter-tight)] text-lg font-semibold">
              찾는 게임이 없어요
            </p>
            <p className="mt-1 text-sm text-muted">
              다른 이름이나 장르로 다시 찾아보세요
            </p>
          </div>
        )}
      </section>
    </>
  );
}
