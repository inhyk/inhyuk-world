"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

const navLinks = [
  { href: "/#games", label: "게임" },
  { href: "/about", label: "소개" },
  { href: "#contact", label: "연락하기" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-8">
        <Link
          href="/"
          className="font-[family-name:var(--font-playfair)] text-2xl font-bold tracking-[-0.02em]"
        >
          InHyuk.
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-[family-name:var(--font-inter)] text-sm font-medium text-muted-strong transition-colors duration-300 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative z-50 flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
          aria-label="Toggle menu"
        >
          <span
            className={`h-[1.5px] w-6 bg-foreground transition-all duration-300 ${
              isOpen ? "translate-y-[7.5px] rotate-45" : ""
            }`}
          />
          <span
            className={`h-[1.5px] w-6 bg-foreground transition-all duration-300 ${
              isOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`h-[1.5px] w-6 bg-foreground transition-all duration-300 ${
              isOpen ? "-translate-y-[7.5px] -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute inset-x-0 top-0 min-h-screen bg-background md:hidden"
          >
            <div className="flex min-h-screen flex-col items-center justify-center gap-8">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="font-[family-name:var(--font-playfair)] text-3xl font-medium text-foreground transition-colors hover:text-muted-strong"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
