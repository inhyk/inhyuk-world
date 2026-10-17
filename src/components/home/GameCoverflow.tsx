"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import type { Game } from "@/data/games";
import { Icon } from "@/components/ui/Icon";

// Distances are in card widths, so the whole rake scales with --cf-card.
const ROTATE = 44;
const DEPTH = 0.6;
const FALLOFF = 0.56;
const FADE = 0.12;
const GAP = 0.05;
const DRAG_START = 6;

function shortTitle(title: string) {
  return title.split(/ · | \/\/ /)[0];
}

// Fold the distance the short way round the ring, so the loop needs no cloned
// cards. A card has to be invisible by the time it jumps to the other side.
function cardStyle(index: number, pos: number, count: number): CSSProperties {
  let offset = (((index - pos) % count) + count) % count;
  if (offset > count / 2) offset -= count;
  const distance = Math.abs(offset);
  const ramp = Math.pow(distance, FALLOFF);
  const tilt = Math.min(ROTATE * ramp, 82) * Math.sign(offset);
  const edge = Math.min(1, Math.max(0, count / 2 - distance));
  const opacity = Math.max(0, 1 - FADE * distance) * edge;
  return {
    transform:
      `translateX(calc(-50% + var(--cf-card) * ${(offset * (1 + GAP)).toFixed(4)})) ` +
      `translateZ(calc(var(--cf-card) * ${(-DEPTH * ramp).toFixed(4)})) ` +
      `rotateY(${(-tilt).toFixed(3)}deg)`,
    opacity: opacity.toFixed(3),
    zIndex: String(100 - Math.round(distance)),
    visibility: opacity < 0.01 ? "hidden" : "visible",
  };
}

export function GameCoverflow({ games }: { games: Game[] }) {
  const router = useRouter();
  const count = games.length;
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posRef = useRef(0);
  // Steps go from where the settle is headed, so a keypress mid-flight counts.
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{
    id: number;
    x: number;
    pos: number;
    pitch: number;
    v: number;
    t: number;
    moved: boolean;
  } | null>(null);
  const [selected, setSelected] = useState(0);

  const indexAt = useCallback(
    (pos: number) => ((Math.round(pos) % count) + count) % count,
    [count],
  );

  // Write straight to the DOM; a re-render per frame would redo every card.
  const paint = useCallback(() => {
    cardRefs.current.forEach((card, index) => {
      if (card) Object.assign(card.style, cardStyle(index, posRef.current, count));
    });
  }, [count]);

  const settle = useCallback(
    (target: number) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      targetRef.current = target;
      setSelected(indexAt(target));

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        posRef.current = target;
        paint();
        return;
      }
      let last = performance.now();
      const step = (now: number) => {
        const remaining = target - posRef.current;
        if (Math.abs(remaining) < 0.0004) {
          posRef.current = target;
          paint();
          rafRef.current = null;
          return;
        }
        // Exponential ease-out scaled by frame time, so 120Hz screens are not
        // twice as fast as 60Hz ones.
        const dt = Math.min(64, Math.max(1, now - last));
        last = now;
        posRef.current += remaining * (1 - Math.pow(0.84, dt / 16.7));
        paint();
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [indexAt, paint],
  );

  const goTo = useCallback(
    (index: number) =>
      settle(index + Math.round((targetRef.current - index) / count) * count),
    [count, settle],
  );

  const nudge = useCallback(
    (by: number) => settle(Math.round(targetRef.current) + by),
    [settle],
  );

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    suppressClickRef.current = false;
    if (event.button !== 0) return;
    const width = cardRefs.current[0]?.offsetWidth ?? 0;
    if (!width) return;
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      pos: posRef.current,
      pitch: width * (1 + GAP),
      v: 0,
      t: performance.now(),
      moved: false,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;

    // Capture only once the press is clearly a drag. Capturing on press would
    // retarget the click to the frame, and the card links would never open.
    if (!drag.moved) {
      if (Math.abs(event.clientX - drag.x) < DRAG_START) return;
      drag.moved = true;
      drag.x = event.clientX;
      drag.pos = posRef.current;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const now = performance.now();
    const previous = posRef.current;
    posRef.current = drag.pos - (event.clientX - drag.x) / drag.pitch;
    // Cards per second, for the throw.
    drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000;
    drag.t = now;
    setSelected(indexAt(posRef.current));
    paint();
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    suppressClickRef.current = true;
    // A flick carries at most two cards. A finger that stopped before letting
    // go carries none, however fast the last move was.
    const v = performance.now() - drag.t > 80 ? 0 : drag.v;
    const carried = Math.max(-2, Math.min(2, v * 0.18));
    settle(Math.round(posRef.current + carried));
  }

  if (count === 0) return null;
  const active = games[selected];

  return (
    <div
      className="coverflow"
      role="region"
      aria-roledescription="carousel"
      aria-label="새로 열린 게임"
    >
      <div className="coverflow-stage-wrap">
        <div
          className="coverflow-frame"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDragStart={(event) => event.preventDefault()}
          onClickCapture={(event) => {
            if (!suppressClickRef.current) return;
            suppressClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              nudge(-1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              nudge(1);
            } else if (event.key === "Enter") {
              router.push(`/games/${active.slug}`);
            }
          }}
        >
          <div className="coverflow-stage">
            {games.map((game, index) => (
              <div
                key={game.slug}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                className="coverflow-card"
                style={cardStyle(index, 0, count)}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} / ${count}`}
                aria-hidden={index !== selected}
              >
                <Link
                  href={`/games/${game.slug}`}
                  tabIndex={-1}
                  draggable={false}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                    // A side card comes to the centre first; only the centre
                    // card opens its game.
                    if (indexAt(targetRef.current) !== index) {
                      event.preventDefault();
                      goTo(index);
                    }
                  }}
                >
                  <Image
                    src={game.thumbnail}
                    alt={`${game.title} 게임 화면`}
                    fill
                    sizes="(max-width: 767px) 64vw, 380px"
                    draggable={false}
                    className="object-cover"
                  />
                </Link>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="coverflow-nav coverflow-prev"
          aria-label="이전 게임"
          onClick={() => nudge(-1)}
        >
          <Icon name="chevron" width="18" height="18" />
        </button>
        <button
          type="button"
          className="coverflow-nav coverflow-next"
          aria-label="다음 게임"
          onClick={() => nudge(1)}
        >
          <Icon name="chevron" width="18" height="18" />
        </button>
      </div>

      <div className="coverflow-caption">
        <span className="mono-label">
          {String(selected + 1).padStart(2, "0")} / {active.category}
        </span>
        <h2>{shortTitle(active.title)}</h2>
        <p>{active.description}</p>
        <Link
          href={`/games/${active.slug}`}
          className="action-button action-primary"
        >
          게임 만나보기
          <Icon name="arrow-up" width="17" height="17" />
        </Link>
      </div>

      <div className="coverflow-dots">
        {games.map((game, index) => (
          <button
            key={game.slug}
            type="button"
            aria-label={`${shortTitle(game.title)} 보기`}
            aria-current={index === selected}
            onClick={() => goTo(index)}
            className={index === selected ? "is-active" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
