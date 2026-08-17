"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { Game } from "@/data/games";
import { getGameCover } from "@/lib/gameVisual";

interface GameCardProps {
  game: Game;
  index: number;
}

export function GameCard({ game, index }: GameCardProps) {
  // 썸네일이 있으면 사진을, 없거나 깨지면 그라데이션 + 이모지를 보여줍니다.
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = Boolean(game.thumbnail) && !imageBroken;

  return (
    <div
      className="fade-up"
      style={{ animationDelay: `${Math.min(index, 7) * 50}ms` }}
    >
      <Link href={`/games/${game.slug}`} className="group block">
        {/* 썸네일 */}
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-surface transition-colors duration-300 group-hover:border-border-strong">
          {showImage ? (
            <Image
              src={game.thumbnail}
              alt={game.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
              onError={() => setImageBroken(true)}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ backgroundImage: getGameCover(game.slug) }}
            >
              <span
                className="text-4xl drop-shadow-[0_4px_16px_rgba(0,0,0,0.45)] transition-transform duration-500 group-hover:scale-110 sm:text-6xl"
                aria-hidden="true"
              >
                {game.emoji}
              </span>
            </div>
          )}

          {/* 카테고리 칩 */}
          <span className="absolute top-2.5 left-2.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md">
            {game.category}
          </span>

          {/* hover 시 플레이 안내 */}
          <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/0 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#08080b]">
              자세히 보기
              <span aria-hidden="true">→</span>
            </span>
          </div>
        </div>

        {/* 정보 */}
        <div className="mt-3.5">
          <h3 className="truncate font-[family-name:var(--font-inter-tight)] text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            {game.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5] text-muted">
            {game.description}
          </p>
        </div>
      </Link>
    </div>
  );
}
