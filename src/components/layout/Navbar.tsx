"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

const navLinks = [
  { href: "/", label: "홈" },
  { href: "/games", label: "게임 컬렉션" },
  { href: "/about", label: "만든 사람" },
  { href: "/stats", label: "방문 통계" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        menuButton.current?.focus();
      }
    }
    function handleResize() {
      if (window.innerWidth >= 768) setIsOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen]);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header className="site-header">
      <nav className="site-container navbar" aria-label="메인 메뉴">
        <Link
          href="/"
          className="brand-lockup"
          aria-label="인혁 월드 홈"
          onClick={() => setIsOpen(false)}
        >
          <span className="brand-mark">
            <Icon name="gamepad" width="23" height="23" />
          </span>
          <span className="brand-word">
            inhyuk<span>world</span>
            <span className="brand-period">.</span>
          </span>
        </Link>
        <div className="desktop-nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={isActive(link.href) ? "is-active" : ""}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="nav-actions">
          <Link
            href="/games"
            className="nav-play"
            onClick={() => setIsOpen(false)}
          >
            LET’S PLAY
            <Icon name="arrow-up" width="16" height="16" />
          </Link>
          <button
            ref={menuButton}
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className={`menu-toggle ${isOpen ? "is-open" : ""}`}
            aria-label={isOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
          >
            <span />
            <span />
          </button>
        </div>
      </nav>
      {isOpen && (
        <nav
          id="mobile-navigation"
          className="mobile-nav"
          aria-label="모바일 메뉴"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              onClick={() => setIsOpen(false)}
            >
              {link.label}
              <Icon name="arrow-up" width="18" height="18" />
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
