import { GameExplorer } from "@/components/home/GameExplorer";
import { MediaFeature } from "@/components/home/MediaFeature";
import { CreatorStrip } from "@/components/home/CreatorStrip";

export default function HomePage() {
  return (
    <>
      <GameExplorer />
      <MediaFeature />
      <CreatorStrip />
    </>
  );
}
