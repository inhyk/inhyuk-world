"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { games, type Game } from "@/data/games";

const sorted = [...games].sort((a, b) => a.order - b.order);

const gradients = [
  "from-rose/30 via-cream to-background",
  "from-background via-rose/20 to-cream",
  "from-cream via-background to-rose/20",
];

// Cards fly in from these positions
const entryPositions = [
  { x: -700, y: -300, rotate: -30 },
  { x: 700, y: 200, rotate: 25 },
  { x: -600, y: 400, rotate: 18 },
  { x: 800, y: -250, rotate: -22 },
];

export function GameShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const count = sorted.length;

  // Scroll budget:
  // 0.00 - 0.05 : cards fly in and gather (fast!)
  // 0.05 - 0.05 + perGame*count : each game gets focus with SNAP
  // last 5% : outro
  const gatherEnd = 0.05;
  const outroStart = 0.95;
  const focusPerGame = (outroStart - gatherEnd) / count;

  return (
    <section
      ref={containerRef}
      id="games"
      // More scroll height = each game "stays" longer
      style={{ height: `${(count * 1.5 + 0.5) * 100}vh` }}
    >
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        {/* Section label */}
        <ShowcaseLabel scrollProgress={scrollYProgress} gatherEnd={gatherEnd} outroStart={outroStart} />

        {/* Game cards */}
        {sorted.map((game, i) => (
          <GameCard
            key={game.slug}
            game={game}
            index={i}
            total={count}
            scrollProgress={scrollYProgress}
            gatherEnd={gatherEnd}
            focusPerGame={focusPerGame}
            outroStart={outroStart}
            entryPos={entryPositions[i % entryPositions.length]}
            gradient={gradients[i % gradients.length]}
          />
        ))}

        {/* Progress dots */}
        <ProgressDots
          scrollProgress={scrollYProgress}
          count={count}
          gatherEnd={gatherEnd}
          focusPerGame={focusPerGame}
          outroStart={outroStart}
        />
      </div>
    </section>
  );
}

function ShowcaseLabel({
  scrollProgress,
  gatherEnd,
  outroStart,
}: {
  scrollProgress: MotionValue<number>;
  gatherEnd: number;
  outroStart: number;
}) {
  const opacity = useTransform(
    scrollProgress,
    [0, gatherEnd, gatherEnd + 0.02, outroStart - 0.02, outroStart],
    [0, 0, 1, 1, 0]
  );

  return (
    <motion.p
      style={{ opacity }}
      className="absolute top-[10%] left-1/2 -translate-x-1/2 font-[family-name:var(--font-playfair)] text-sm tracking-[0.15em] text-muted uppercase"
    >
      나의 게임
    </motion.p>
  );
}

function GameCard({
  game,
  index,
  total,
  scrollProgress,
  gatherEnd,
  focusPerGame,
  outroStart,
  entryPos,
  gradient,
}: {
  game: Game;
  index: number;
  total: number;
  scrollProgress: MotionValue<number>;
  gatherEnd: number;
  focusPerGame: number;
  outroStart: number;
  entryPos: { x: number; y: number; rotate: number };
  gradient: string;
}) {
  // Focus timing for this card
  const focusStart = gatherEnd + index * focusPerGame;
  const focusEnd = focusStart + focusPerGame;

  // The "snap" zone: card is fully focused for the middle 70% of its time
  // Transitions happen in the first/last 15% → feels like snapping
  const snapIn = focusStart + focusPerGame * 0.08;
  const holdStart = focusStart + focusPerGame * 0.15;
  const holdEnd = focusEnd - focusPerGame * 0.15;
  const snapOut = focusEnd - focusPerGame * 0.08;

  // Resting position: fanned out behind
  const spread = ((index - (total - 1) / 2) / Math.max(total - 1, 1)) * 60;
  const restX = spread * 5;
  const restY = Math.abs(spread) * 0.8 + 15;
  const restRotate = spread * 0.25;

  // --- X: snap to center when focused ---
  const x = useTransform(
    scrollProgress,
    [0, gatherEnd, snapIn, holdStart, holdEnd, snapOut, outroStart, 1],
    [entryPos.x, restX, restX * 0.2, 0, 0, restX * 0.2, restX, entryPos.x * 0.6]
  );

  // --- Y: snap to center ---
  const y = useTransform(
    scrollProgress,
    [0, gatherEnd, snapIn, holdStart, holdEnd, snapOut, outroStart, 1],
    [entryPos.y, restY, restY * 0.3, 0, 0, restY * 0.3, restY, entryPos.y * 0.6]
  );

  // --- Scale: SNAP to full size ---
  const scale = useTransform(
    scrollProgress,
    [0, gatherEnd, snapIn, holdStart, holdEnd, snapOut, outroStart, 1],
    [0.2, 0.5, 0.7, 1, 1, 0.7, 0.5, 0.15]
  );

  // --- Opacity: sharp transitions ---
  const opacity = useTransform(
    scrollProgress,
    [0, gatherEnd * 0.3, gatherEnd, snapIn, holdStart, holdEnd, snapOut, outroStart, 1],
    [0, 0.5, 0.35, 0.5, 1, 1, 0.5, 0.35, 0]
  );

  // --- Rotate: snap to 0 ---
  const rotate = useTransform(
    scrollProgress,
    [0, gatherEnd, snapIn, holdStart, holdEnd, snapOut],
    [entryPos.rotate, restRotate, restRotate * 0.3, 0, 0, restRotate * 0.3]
  );

  // --- Z-index ---
  const zIndex = useTransform(
    scrollProgress,
    [snapIn, holdStart, holdEnd, snapOut],
    [index, 20, 20, index]
  );

  // --- Ring highlight when focused ---
  const ringOpacity = useTransform(
    scrollProgress,
    [snapIn, holdStart, holdEnd, snapOut],
    [0, 0.15, 0.15, 0]
  );

  // --- Info text: appears with snap ---
  const infoOpacity = useTransform(
    scrollProgress,
    [snapIn, holdStart, holdEnd, snapOut],
    [0, 1, 1, 0]
  );

  const infoY = useTransform(
    scrollProgress,
    [snapIn, holdStart, holdEnd, snapOut],
    [30, 0, 0, -30]
  );

  // --- Shadow intensity when focused ---
  const shadowBlur = useTransform(
    scrollProgress,
    [snapIn, holdStart, holdEnd, snapOut],
    [0, 40, 40, 0]
  );

  return (
    <motion.div
      className="absolute"
      style={{ x, y, scale, opacity, rotate, zIndex }}
    >
      <Link href={`/games/${game.slug}`} className="group block">
        {/* Card visual */}
        <motion.div
          className={`relative flex aspect-[4/5] w-[280px] items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} ring-1 ring-foreground/[0.04] transition-shadow duration-300 group-hover:shadow-2xl md:w-[360px]`}
          style={{
            boxShadow: useTransform(
              shadowBlur,
              (v) => `0 ${v * 0.5}px ${v}px rgba(26,26,26,0.08)`
            ),
          }}
        >
          <span className="text-[7rem] transition-transform duration-500 group-hover:scale-110 md:text-[9rem]">
            {game.emoji}
          </span>

          {/* Focus ring glow */}
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-inset ring-foreground"
            style={{ opacity: ringOpacity }}
          />
        </motion.div>

        {/* Info (snaps in with card) */}
        <motion.div
          style={{ opacity: infoOpacity, y: infoY }}
          className="mt-6 text-center"
        >
          <h3 className="font-[family-name:var(--font-playfair)] text-2xl font-bold tracking-tight md:text-3xl">
            {game.title}
          </h3>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-strong">
            {game.description}
          </p>
          <p className="mt-3 text-xs tracking-wide text-muted">
            {game.category} · {game.techStack.join(" · ")}
          </p>
        </motion.div>
      </Link>
    </motion.div>
  );
}

function ProgressDots({
  scrollProgress,
  count,
  gatherEnd,
  focusPerGame,
  outroStart,
}: {
  scrollProgress: MotionValue<number>;
  count: number;
  gatherEnd: number;
  focusPerGame: number;
  outroStart: number;
}) {
  const containerOpacity = useTransform(
    scrollProgress,
    [gatherEnd, gatherEnd + 0.02, outroStart - 0.02, outroStart],
    [0, 1, 1, 0]
  );

  return (
    <motion.div
      style={{ opacity: containerOpacity }}
      className="absolute bottom-[8%] left-1/2 flex -translate-x-1/2 gap-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Dot
          key={i}
          index={i}
          scrollProgress={scrollProgress}
          gatherEnd={gatherEnd}
          focusPerGame={focusPerGame}
        />
      ))}
    </motion.div>
  );
}

function Dot({
  index,
  scrollProgress,
  gatherEnd,
  focusPerGame,
}: {
  index: number;
  scrollProgress: MotionValue<number>;
  gatherEnd: number;
  focusPerGame: number;
}) {
  const focusStart = gatherEnd + index * focusPerGame;
  const holdStart = focusStart + focusPerGame * 0.15;
  const holdEnd = focusStart + focusPerGame * 0.85;

  // Snappy width change
  const width = useTransform(
    scrollProgress,
    [focusStart, holdStart, holdEnd, holdEnd + focusPerGame * 0.1],
    [12, 36, 36, 12]
  );

  const bg = useTransform(
    scrollProgress,
    [focusStart, holdStart, holdEnd, holdEnd + focusPerGame * 0.1],
    [0.15, 0.5, 0.5, 0.15]
  );

  return (
    <motion.div
      style={{ width, opacity: bg }}
      className="h-2 rounded-full bg-foreground"
    />
  );
}
