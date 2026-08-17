"use client";

import { useState } from "react";
import Image from "next/image";

interface VideoEmbedProps {
  youtubeId: string;
  title: string;
  thumbnail: string;
  /** next/image 에 넘길 sizes. 놓이는 자리마다 다릅니다. */
  sizes?: string;
  priority?: boolean;
}

/**
 * 처음에는 썸네일만 깔아 두고, 누른 뒤에야 유튜브 iframe 을 붙입니다.
 * 유튜브 플레이어는 무거워서 그냥 심어 두면 첫 화면 로딩을 잡아먹습니다.
 * (재생 전까지는 유튜브에 아무 요청도 가지 않습니다.)
 */
export function VideoEmbed({
  youtubeId,
  title,
  thumbnail,
  sizes = "(max-width: 768px) 100vw, 640px",
  priority = false,
}: VideoEmbedProps) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-surface">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`영상 재생: ${title}`}
          className="group absolute inset-0 h-full w-full cursor-pointer"
        >
          <Image
            src={thumbnail}
            alt=""
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute inset-0 bg-[#08080b]/25 transition-colors group-hover:bg-[#08080b]/10" />

          {/* 재생 버튼 */}
          <span className="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-110 md:h-[72px] md:w-[72px]">
            <svg
              width="22"
              height="24"
              viewBox="0 0 22 24"
              fill="none"
              aria-hidden="true"
              className="ml-1"
            >
              <path d="M21 12L0 24V0l21 12z" fill="#08080b" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
