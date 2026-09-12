# Inhyuk World — Play Portal

The visual concept is a small creator opening a window into handmade worlds. Charcoal, warm white, chartreuse, and restrained orange connect the navigation, collection, video stories, creator introduction, and footer. The hero pairs a Korean headline with an original floating console sculpture.

The home collection starts with eight games and offers progressive loading. Search, categories, alphabetical/recent sorting, and random discovery use the existing game catalogue. The dedicated collection continues to show all games. Mobile navigation supports Escape and returns focus to its toggle; a skip link and reduced-motion styling support keyboard and motion-sensitive visitors.

## Original artwork

- Workspace asset: [`public/images/world-console.png`](../public/images/world-console.png)
- Method: built-in `image_gen` tool, not the CLI fallback.
- Output: 1254 × 1254 PNG with transparency. Served through Next.js Image optimization.
- Used in: `src/components/home/HomeHero.tsx`.

### Final generation prompt

```text
Use case: stylized-concept. Asset type: a premium original 3D hero artwork for a young independent game creator's portfolio website, named Inhyuk World, whose creative concept is a portal into handmade worlds. Create a single striking, beautifully art-directed floating sculpture, on a genuinely transparent background with alpha. Subject: a sculptural retro handheld game console, chunky rounded rectangular, in warm off-white ceramic and electric chartreuse green, tilted at a three-quarter perspective with the top toward the upper right. The deep black glossy screen is a magical window into a miniature voxel landscape: a small lush green floating island with blocky trees, tiny pale stairs and a glowing little sun. Physical controls below screen: one black cross-shaped D pad, two small burnt-orange circular buttons, two tiny horizontal speaker slits. A large thin brushed-chrome Saturn-like orbit loops diagonally AROUND the handheld; two or three small chartreuse cubes, a little vivid orange sphere, and one tiny four-point cream star float on the orbit. Style: luxury design studio CGI, tactile clay meets anodized aluminum and glass, highly polished Octane render, sophisticated playful collectible object, realistic beautiful reflections and ambient occlusion. Palette: luminous pale chartreuse #c8fa72, bone #f2f0e8, graphite #10110f, restrained burnt orange #ff835e, polished silver. Composition: centered isolated full object with generous clear margin on ALL sides, entire orbit visible, object fills about 80% of a square canvas. Dramatic soft top-left studio lighting, shadow detail, very crisp silhouette. NO text, NO letters, NO logos, NO watermark, NO typography, NO rectangular backdrop, no extra console, no floor plane. Transparent background.
```
