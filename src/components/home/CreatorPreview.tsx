"use client";

import Link from "next/link";
import { motion } from "motion/react";

export function CreatorPreview() {
  return (
    <section className="py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-3">
          {/* Left: "The creator" link */}
          <div className="md:col-span-1">
            <Link href="/about" className="group inline-block">
              <motion.div
                className="flex items-center gap-3"
                whileHover="hover"
                initial="rest"
              >
                <span className="font-[family-name:var(--font-playfair)] text-2xl tracking-[-0.02em] md:text-3xl">
                  만든 사람
                </span>
                <motion.span
                  className="text-2xl text-muted"
                  variants={{
                    rest: { x: 0 },
                    hover: { x: 8 },
                  }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  &rarr;
                </motion.span>
              </motion.div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
                게임을 만드는 사람이 궁금하다면
              </p>
            </Link>
          </div>

          {/* Right: Large visual */}
          <motion.div
            className="md:col-span-2"
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{
              duration: 0.8,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-rose/20 via-cream to-background">
              {/* Scattered emoji collage */}
              <span className="absolute top-[15%] left-[20%] text-5xl opacity-60 md:text-6xl">🎮</span>
              <span className="absolute top-[25%] right-[15%] text-4xl opacity-50 md:text-5xl">🌙</span>
              <span className="absolute bottom-[20%] left-[35%] text-6xl opacity-40 md:text-7xl">🎵</span>
              <span className="absolute right-[30%] bottom-[30%] text-4xl opacity-50 md:text-5xl">⭐</span>
              <span className="absolute top-[50%] left-[10%] text-3xl opacity-30 md:text-4xl">🕹️</span>

              {/* Subtle ring overlay */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/[0.04]" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
