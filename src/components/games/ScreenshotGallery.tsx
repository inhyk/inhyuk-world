"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ScreenshotGalleryProps {
  screenshots: string[];
  title: string;
}

export function ScreenshotGallery({
  screenshots,
  title,
}: ScreenshotGalleryProps) {
  const [selected, setSelected] = useState(0);
  const [direction, setDirection] = useState(0);

  const goTo = useCallback(
    (dir: 1 | -1) => {
      setDirection(dir);
      setSelected((prev) => {
        const next = prev + dir;
        if (next < 0) return screenshots.length - 1;
        if (next >= screenshots.length) return 0;
        return next;
      });
    },
    [screenshots.length]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goTo(-1);
      if (e.key === "ArrowRight") goTo(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goTo]);

  if (screenshots.length === 0) return null;

  const emojiMap: Record<string, string> = {
    "긴긴밤": "🌙",
    "Rhythm Game": "🎵",
  };
  const emoji = emojiMap[title] || "🎮";

  return (
    <div>
      {/* Main Visual */}
      <div className="relative aspect-video overflow-hidden rounded-3xl bg-cream">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selected}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex h-full items-center justify-center"
          >
            <span className="text-7xl md:text-8xl">{emoji}</span>
          </motion.div>
        </AnimatePresence>

        {screenshots.length > 1 && (
          <>
            <button
              onClick={() => goTo(-1)}
              className="absolute top-1/2 left-4 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/5 text-foreground/60 backdrop-blur-sm transition-colors hover:bg-foreground/10 hover:text-foreground"
              aria-label="Previous screenshot"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={() => goTo(1)}
              className="absolute top-1/2 right-4 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/5 text-foreground/60 backdrop-blur-sm transition-colors hover:bg-foreground/10 hover:text-foreground"
              aria-label="Next screenshot"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Pill Indicators */}
      {screenshots.length > 1 && (
        <div className="mt-5 flex justify-center gap-2">
          {screenshots.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > selected ? 1 : -1);
                setSelected(i);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === selected
                  ? "w-8 bg-foreground/40"
                  : "w-4 bg-foreground/10 hover:bg-foreground/20"
              }`}
              aria-label={`Screenshot ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
