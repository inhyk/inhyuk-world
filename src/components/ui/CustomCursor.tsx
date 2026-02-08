"use client";

import { useEffect, useRef } from "react";

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const isHovering = useRef(false);

  useEffect(() => {
    // Only show custom cursor on desktop
    if (typeof window === "undefined" || window.matchMedia("(pointer: coarse)").matches) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const onMouseEnterLink = () => {
      isHovering.current = true;
      cursor.classList.add("hovering");
    };

    const onMouseLeaveLink = () => {
      isHovering.current = false;
      cursor.classList.remove("hovering");
    };

    const animate = () => {
      const ease = 0.15;
      cursorX += (mouseX - cursorX) * ease;
      cursorY += (mouseY - cursorY) * ease;
      cursor.style.transform = `translate(${cursorX - 4}px, ${cursorY - 4}px)${isHovering.current ? " scale(6)" : ""}`;
      requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", onMouseMove);

    const interactiveElements = document.querySelectorAll("a, button, [data-cursor-hover]");
    interactiveElements.forEach((el) => {
      el.addEventListener("mouseenter", onMouseEnterLink);
      el.addEventListener("mouseleave", onMouseLeaveLink);
    });

    const observer = new MutationObserver(() => {
      const elements = document.querySelectorAll("a, button, [data-cursor-hover]");
      elements.forEach((el) => {
        el.addEventListener("mouseenter", onMouseEnterLink);
        el.addEventListener("mouseleave", onMouseLeaveLink);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    animate();

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      observer.disconnect();
      interactiveElements.forEach((el) => {
        el.removeEventListener("mouseenter", onMouseEnterLink);
        el.removeEventListener("mouseleave", onMouseLeaveLink);
      });
    };
  }, []);

  // Don't render on mobile/touch devices
  if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
    return null;
  }

  return <div ref={cursorRef} className="cursor-dot hidden md:block" />;
}
