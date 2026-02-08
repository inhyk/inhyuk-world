"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import type { Game } from "@/data/games";

interface GameCardProps {
  game: Game;
  index: number;
}

const gradients = [
  "from-rose/30 via-cream to-background",
  "from-background via-rose/20 to-cream",
];

export function GameCard({ game, index }: GameCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: 0.8,
        delay: index * 0.15,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <Link href={`/games/${game.slug}`} className="group block">
        {/* Large image area */}
        <div className="relative overflow-hidden rounded-2xl">
          <motion.div
            style={{ y }}
            className={`flex aspect-[4/5] items-center justify-center bg-gradient-to-br ${gradients[index % gradients.length]}`}
          >
            <span className="text-[8rem] transition-transform duration-500 group-hover:scale-110 md:text-[10rem]">
              {game.emoji}
            </span>
          </motion.div>

          {/* Subtle overlay on hover */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/[0.04] transition-all duration-500 group-hover:ring-foreground/[0.08]" />
        </div>

        {/* Info below image: name (left), category (right) */}
        <div className="mt-4 flex items-baseline justify-between px-1">
          <h3 className="font-[family-name:var(--font-playfair)] text-lg tracking-[-0.02em] md:text-xl">
            {game.title}
          </h3>
          <span className="text-sm text-muted">
            {game.category}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
