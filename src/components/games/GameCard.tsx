"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/Badge";
import type { Game } from "@/data/games";

interface GameCardProps {
  game: Game;
  index: number;
}

export function GameCard({ game, index }: GameCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
    >
      <Link href={`/games/${game.slug}`} className="group block">
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-1 transition-all duration-300 group-hover:border-lavender/30 group-hover:bg-card-hover group-hover:scale-[1.02] group-hover:shadow-[0_0_40px_rgba(242,234,239,0.06)]">
          {/* 썸네일 */}
          <div className="relative aspect-video overflow-hidden rounded-xl bg-background">
            <div className="flex h-full items-center justify-center text-6xl">
              {game.emoji}
            </div>
            {game.featured && (
              <div className="absolute top-3 right-3">
                <Badge className="border-lavender/30 bg-lavender/10 text-lavender">
                  Featured
                </Badge>
              </div>
            )}
          </div>

          {/* 정보 */}
          <div className="p-5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{game.category}</span>
              <span className="text-xs text-border">·</span>
              <span className="text-xs text-muted">{game.createdAt}</span>
            </div>
            <h3 className="mt-2 font-[family-name:var(--font-dm-sans)] text-lg font-bold tracking-[-0.03em]">
              {game.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {game.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {game.techStack.map((tech) => (
                <Badge key={tech} className="text-[10px]">
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
