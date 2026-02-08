"use client";

import { useEffect } from "react";

interface SmoothScrollProps {
  children: React.ReactNode;
}

export function SmoothScroll({ children }: SmoothScrollProps) {
  useEffect(() => {
    // Use native smooth scrolling with optimized behavior
    document.documentElement.style.scrollBehavior = "smooth";

    return () => {
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);

  return <>{children}</>;
}
