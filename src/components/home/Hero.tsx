"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={containerRef}
      className="relative flex h-screen items-center justify-center overflow-hidden"
    >
      {/* Parallax background - gradient + emoji collage */}
      <motion.div
        style={{ y: backgroundY }}
        className="absolute inset-0 -top-20"
      >
        {/* Gradient base */}
        <div className="absolute inset-0 bg-gradient-to-b from-cream via-background to-background" />

        {/* Large decorative emojis - scattered collage */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-[80vh] w-full max-w-5xl">
            <span className="absolute top-[8%] left-[10%] text-7xl opacity-20 blur-[1px] sm:text-8xl md:text-9xl">
              🎮
            </span>
            <span className="absolute top-[15%] right-[12%] text-6xl opacity-15 blur-[0.5px] sm:text-7xl md:text-8xl">
              🕹️
            </span>
            <span className="absolute top-[45%] left-[5%] text-5xl opacity-10 sm:text-6xl md:text-7xl">
              🎯
            </span>
            <span className="absolute top-[55%] right-[8%] text-6xl opacity-12 blur-[0.5px] sm:text-7xl md:text-8xl">
              🚀
            </span>
            <span className="absolute bottom-[20%] left-[25%] text-5xl opacity-10 sm:text-6xl md:text-7xl">
              ⭐
            </span>
            <span className="absolute top-[30%] left-[45%] text-4xl opacity-8 sm:text-5xl md:text-6xl">
              🎨
            </span>
            <span className="absolute bottom-[35%] right-[30%] text-5xl opacity-10 sm:text-6xl md:text-7xl">
              💎
            </span>
          </div>
        </div>

        {/* Soft radial overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,transparent_0%,var(--color-background)_100%)]" />
      </motion.div>

      {/* Text overlay with parallax */}
      <motion.div
        style={{ y: textY, opacity }}
        className="relative z-10 px-6 text-center"
      >
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="font-[family-name:var(--font-playfair)] text-lg italic text-muted-strong sm:text-xl"
        >
          Welcome to
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
          className="mt-4 font-[family-name:var(--font-playfair)] text-6xl font-bold tracking-[-0.03em] sm:text-7xl md:text-8xl lg:text-9xl"
        >
          인혁이의
          <br />
          게임 월드
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-8"
        >
          <p className="font-[family-name:var(--font-inter)] text-sm tracking-widest text-muted uppercase">
            직접 만든 게임들을 구경하고 플레이해 보세요
          </p>
        </motion.div>
      </motion.div>

      {/* Minimal scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.8 }}
        style={{ opacity }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-3"
        >
          <span className="font-[family-name:var(--font-inter)] text-[10px] tracking-[0.2em] text-muted uppercase">
            스크롤
          </span>
          <div className="h-8 w-[1px] bg-muted" />
        </motion.div>
      </motion.div>
    </section>
  );
}
