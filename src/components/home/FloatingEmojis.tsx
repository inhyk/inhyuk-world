"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

const emojis = [
  { char: "🎮", x: "12%", y: "20%", size: "text-5xl md:text-7xl", rotate: -12, from: "left" as const, speed: 0.4 },
  { char: "🕹️", x: "78%", y: "12%", size: "text-5xl md:text-6xl", rotate: 8, from: "right" as const, speed: 0.5 },
  { char: "🎵", x: "22%", y: "60%", size: "text-6xl md:text-8xl", rotate: -6, from: "left" as const, speed: 0.35 },
  { char: "🌙", x: "82%", y: "55%", size: "text-5xl md:text-6xl", rotate: 15, from: "right" as const, speed: 0.6 },
  { char: "🚀", x: "48%", y: "8%", size: "text-4xl md:text-5xl", rotate: -20, from: "top" as const, speed: 0.45 },
  { char: "🎯", x: "35%", y: "78%", size: "text-5xl md:text-6xl", rotate: 10, from: "bottom" as const, speed: 0.5 },
  { char: "⭐", x: "65%", y: "72%", size: "text-5xl md:text-7xl", rotate: -8, from: "right" as const, speed: 0.55 },
];

export function FloatingEmojis() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  return (
    <section ref={ref} className="relative overflow-hidden py-20 md:py-32">
      <div className="relative mx-auto h-[50vh] max-w-6xl px-6 md:h-[60vh]">
        {emojis.map((emoji, i) => (
          <FloatingEmoji
            key={i}
            emoji={emoji}
            scrollProgress={scrollYProgress}
            index={i}
          />
        ))}
      </div>
    </section>
  );
}

function FloatingEmoji({
  emoji,
  scrollProgress,
  index,
}: {
  emoji: (typeof emojis)[number];
  scrollProgress: MotionValue<number>;
  index: number;
}) {
  // Each emoji flies in from outside the viewport based on its "from" direction
  // scrollYProgress 0 = section enters viewport, 0.5 = center, 1 = leaves
  // We want: at 0 → far outside, at 0.3~0.4 → arrive at position, then gentle float

  const offsetMap = {
    left: { x: [-600, 0], y: [0, 0] },
    right: { x: [600, 0], y: [0, 0] },
    top: { x: [0, 0], y: [-400, 0] },
    bottom: { x: [0, 0], y: [400, 0] },
  };

  const offsets = offsetMap[emoji.from];
  const stagger = index * 0.03; // slight stagger per emoji

  const x = useTransform(
    scrollProgress,
    [0, 0.25 + stagger, 0.5, 1],
    [offsets.x[0], offsets.x[1], offsets.x[1], offsets.x[1]]
  );

  const y = useTransform(
    scrollProgress,
    [0, 0.25 + stagger, 0.5, 1],
    [
      offsets.y[0] + 80 * emoji.speed,
      offsets.y[1],
      -30 * emoji.speed,
      -80 * emoji.speed,
    ]
  );

  const opacity = useTransform(
    scrollProgress,
    [0, 0.15 + stagger, 0.3 + stagger, 0.85, 1],
    [0, 0.3, 1, 1, 0]
  );

  const scale = useTransform(
    scrollProgress,
    [0, 0.25 + stagger, 0.5],
    [0.3, 1, 1]
  );

  const rotate = useTransform(
    scrollProgress,
    [0, 0.3 + stagger, 1],
    [emoji.rotate * 3, emoji.rotate, emoji.rotate * 0.5]
  );

  return (
    <motion.div
      className={`absolute ${emoji.size}`}
      style={{
        left: emoji.x,
        top: emoji.y,
        x,
        y,
        opacity,
        scale,
        rotate,
      }}
    >
      <span className="inline-block drop-shadow-[0_4px_24px_rgba(201,160,176,0.25)]">
        {emoji.char}
      </span>
    </motion.div>
  );
}
