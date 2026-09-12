"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { Game } from "@/data/games";
import { getGameCover } from "@/lib/gameVisual";
import { Icon } from "@/components/ui/Icon";

export function GameCard({ game, index }: { game: Game; index: number }) {
  const [imageBroken, setImageBroken] = useState(false);
  return (
    <article
      className="game-card fade-up"
      style={{ animationDelay: `${Math.min(index, 7) * 40}ms` }}
    >
      <Link href={`/games/${game.slug}`} className="game-card-link">
        <div className="game-card-cover">
          {game.thumbnail && !imageBroken ? (
            <Image
              src={game.thumbnail}
              alt={`${game.title} 게임 화면`}
              fill
              sizes="(max-width: 599px) 100vw, (max-width: 1023px) 50vw, 25vw"
              className="object-cover"
              onError={() => setImageBroken(true)}
            />
          ) : (
            <div
              className="game-card-fallback"
              style={{ backgroundImage: getGameCover(game.slug) }}
            >
              <span aria-hidden="true">{game.emoji}</span>
              <span className="fallback-title">{game.title}</span>
            </div>
          )}
          <span className="game-category">{game.category}</span>
          {game.featured && (
            <span className="game-featured">
              <Icon name="spark" width="11" height="11" /> PICK
            </span>
          )}
          <span className="game-card-overlay">
            <span>
              게임 만나보기
              <Icon name="arrow-up" width="17" height="17" />
            </span>
          </span>
        </div>
        <div className="game-card-info">
          <div className="game-card-title">
            <h3>{game.title}</h3>
            <Icon name="arrow-up" width="18" height="18" />
          </div>
          <p>{game.description}</p>
          <div className="game-card-meta">
            <span>{game.techStack.slice(0, 2).join(" / ")}</span>
            <span>
              {game.playUrl ? (
                <>
                  <span className="status-dot" />
                  PLAY NOW
                </>
              ) : (
                "IN THE LAB"
              )}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
