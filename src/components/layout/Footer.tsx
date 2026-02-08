import Link from "next/link";

export function Footer() {
  return (
    <footer id="contact" className="bg-background px-6 pb-12 pt-24 md:px-8 md:pt-32">
      <div className="mx-auto max-w-6xl">
        {/* CTA Section */}
        <div className="flex flex-col items-center text-center">
          <h2 className="font-[family-name:var(--font-playfair)] text-4xl font-bold tracking-[-0.02em] sm:text-5xl md:text-6xl">
            저를 지켜봐 주세요
          </h2>
          <p className="mt-4 max-w-md font-[family-name:var(--font-inter)] text-base text-muted-strong">
            새로운 게임과 업데이트 소식을 받아보세요
          </p>

          {/* Email input - pill style */}
          <div className="mt-10 flex w-full max-w-md items-center rounded-full border border-border bg-cream px-2 py-1.5">
            <input
              type="email"
              placeholder="이메일 주소"
              className="flex-1 bg-transparent px-4 py-2 font-[family-name:var(--font-inter)] text-sm text-foreground placeholder:text-muted outline-none"
            />
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:bg-accent-hover"
              aria-label="Subscribe"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 8H13M13 8L8.5 3.5M13 8L8.5 12.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Large logo */}
        <div className="mt-24 flex justify-center md:mt-32">
          <span className="font-[family-name:var(--font-playfair)] text-[18vw] font-bold leading-none tracking-[-0.04em] text-foreground/[0.06] sm:text-[14vw] md:text-[12vw]">
            InHyuk.
          </span>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-border pt-8 md:flex-row">
          <p className="font-[family-name:var(--font-inter)] text-xs text-muted">
            &copy; {new Date().getFullYear()} InHyuk. 모든 권리 보유.
          </p>

          <div className="flex items-center gap-8">
            <Link
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-[family-name:var(--font-inter)] text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              GitHub
            </Link>
            <Link
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-[family-name:var(--font-inter)] text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              Instagram
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
