"use client";

import { motion } from "motion/react";

export function QuoteSection() {
  return (
    <section className="py-32 md:py-40">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <motion.h2
          className="font-[family-name:var(--font-playfair)] text-5xl leading-[1.1] tracking-[-0.03em] text-muted md:text-7xl"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{
            duration: 1,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          열정으로 만들고,
          <br />
          즐거움으로 플레이하다
        </motion.h2>
      </div>
    </section>
  );
}
