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

  const goTo = useCallback(
    (dir: 1 | -1) => {
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

  return (
    <div>
      {/* 메인 이미지 */}
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-background">
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex h-full items-center justify-center text-7xl"
          >
            {title.includes("Space") ? "🚀" : title.includes("Snake") ? "🐍" : "🃏"}
          </motion.div>
        </AnimatePresence>

        {screenshots.length > 1 && (
          <>
            <button
              onClick={() => goTo(-1)}
              className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-card"
              aria-label="이전 스크린샷"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={() => goTo(1)}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-card"
              aria-label="다음 스크린샷"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* 썸네일 스트립 */}
      {screenshots.length > 1 && (
        <div className="mt-4 flex gap-2">
          {screenshots.map((_, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`h-2 flex-1 rounded-full transition-all ${
                i === selected
                  ? "bg-lavender"
                  : "bg-border hover:bg-muted"
              }`}
              aria-label={`스크린샷 ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
