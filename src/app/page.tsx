import { Hero } from "@/components/home/Hero";
import { GameShowcase } from "@/components/home/GameShowcase";
import { QuoteSection } from "@/components/home/QuoteSection";
import { CreatorPreview } from "@/components/home/CreatorPreview";

export default function HomePage() {
  return (
    <>
      <Hero />
      <GameShowcase />
      <QuoteSection />
      <CreatorPreview />
    </>
  );
}
