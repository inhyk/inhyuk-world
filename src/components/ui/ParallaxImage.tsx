"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

interface ParallaxImageProps {
  children: React.ReactNode;
  className?: string;
  speed?: number;
  scale?: boolean;
}

export function ParallaxImage({
  children,
  className,
  speed = 0.3,
  scale = false,
}: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [speed * 100, -speed * 100]);
  const scaleValue = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 0.95]);

  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <motion.div
        style={{
          y,
          ...(scale ? { scale: scaleValue } : {}),
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
