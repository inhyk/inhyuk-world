"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

interface TextRevealProps {
  children: string;
  className?: string;
}

export function TextReveal({ children, className }: TextRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.9", "start 0.3"],
  });

  const opacity = useTransform(scrollYProgress, [0, 1], [0.15, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [20, 0]);

  return (
    <motion.div
      ref={ref}
      style={{ opacity, y }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
