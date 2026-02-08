import { games } from "@/data/games";
import { GameCard } from "@/components/games/GameCard";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export function GameGrid() {
  const sorted = [...games].sort((a, b) => a.order - b.order);

  return (
    <section id="games" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <AnimatedSection>
          <h2 className="font-[family-name:var(--font-dm-sans)] text-3xl font-black tracking-[-0.05em] md:text-4xl">
            Games
          </h2>
          <p className="mt-2 text-muted">직접 만든 게임들을 구경해 보세요</p>
        </AnimatedSection>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((game, i) => (
            <GameCard key={game.slug} game={game} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
