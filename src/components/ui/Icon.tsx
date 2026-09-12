import type { SVGProps } from "react";

type IconName =
  | "arrow"
  | "arrow-up"
  | "play"
  | "search"
  | "shuffle"
  | "grid"
  | "gamepad"
  | "spark"
  | "close"
  | "chevron";

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    "arrow-up": <path d="M6 18 18 6M6 6h12v12" />,
    play: <path d="m9 5 11 7-11 7V5Z" fill="currentColor" strokeWidth="0" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    shuffle: (
      <>
        <path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c1.6 0 3-1.2 4.3-3M14 9c1.2-1.8 2.5-3 4-3h3m-4-4 4 4-4 4" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    gamepad: (
      <>
        <path d="M7.5 6h9c2 0 3.2 1.2 3.7 3.2l1.5 7c.6 2.8-2.1 4.1-3.8 2l-2.2-2.7H8.3l-2.2 2.7c-1.7 2.1-4.4.8-3.8-2l1.5-7C4.3 7.2 5.5 6 7.5 6Z" />
        <path d="M6 10.5h5m-2.5-2.5v5" />
        <circle cx="16" cy="10" r=".8" fill="currentColor" />
        <circle cx="18" cy="12.5" r=".8" fill="currentColor" />
      </>
    ),
    spark: (
      <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    chevron: <path d="m6 9 6 6 6-6" />,
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
