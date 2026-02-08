"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { games } from "@/data/games";
import { GameCard } from "@/components/games/GameCard";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export function GameGrid() {
  const sorted = [...games].sort((a, b) => a.order - b.order);

  return (
    <section id="games" className="py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section title - centered */}
        <AnimatedSection className="text-center">
          <p className="font-[family-name:var(--font-playfair)] text-sm tracking-[0.15em] text-muted uppercase">
            나의 게임
          </p>
        </AnimatedSection>

        {/* Asymmetric 2-column grid */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
          {sorted.map((game, i) => (
            <div
              key={game.slug}
              className={i % 2 === 1 ? "md:mt-24" : ""}
            >
              <GameCard game={game} index={i} />
            </div>
          ))}
        </div>

        {/* "See them all" pill button */}
        <AnimatedSection delay={0.3} className="mt-20 flex justify-center">
          <Link href="/games">
            <motion.span
              className="inline-flex items-center gap-2 rounded-full border border-foreground/10 px-8 py-3 font-[family-name:var(--font-inter)] text-sm tracking-wide text-foreground transition-colors hover:border-foreground/25 hover:bg-foreground/[0.03]"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              모두 보기
              <span className="text-muted">&rarr;</span>
            </motion.span>
          </Link>
        </AnimatedSection>
      </div>
    </section>
  );
}
