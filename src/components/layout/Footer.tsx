import Link from "next/link";
import { games } from "@/data/games";

export function Footer() {
  const topGames = games.slice(0, 4);

  return (
    <footer id="contact" className="relative overflow-hidden">
      {/* 그라데이션 배경 */}
      <div className="mesh absolute inset-0" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background to-transparent" />

      <div className="relative px-3 pt-20 pb-3 md:px-4 md:pt-28 md:pb-4">
        {/* CTA */}
        <div className="mx-auto max-w-2xl px-4 pb-14 text-center md:pb-20">
          <p className="text-sm font-medium text-white/75">인혁이의 게임 월드</p>
          <h2 className="mt-3 font-[family-name:var(--font-inter-tight)] text-[28px] leading-[1.15] font-extrabold tracking-[-0.03em] text-white md:text-[40px]">
            새로운 게임이 계속 올라옵니다
          </h2>
          <Link
            href="/games"
            className="mt-7 inline-block rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#08080b] transition-transform hover:scale-[1.04]"
          >
            게임 보러 가기
          </Link>
        </div>

        {/* 링크 패널 */}
        <div className="mx-auto max-w-7xl rounded-3xl bg-[#0c0c10] p-8 md:p-12">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="h-6 w-6 rounded-lg bg-gradient-to-br from-[#6366f1] via-[#a855f7] to-[#f43f5e]" />
                <span className="font-[family-name:var(--font-inter-tight)] text-[17px] font-bold tracking-[-0.02em]">
                  인혁 월드
                </span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
                직접 만든 게임을 모아 둔 곳입니다. 마음에 드는 게임이 있으면
                바로 플레이해 보세요.
              </p>
            </div>

            <FooterColumn title="게임">
              {topGames.map((game) => (
                <FooterLink key={game.slug} href={`/games/${game.slug}`}>
                  {game.title}
                </FooterLink>
              ))}
              <FooterLink href="/games">전체 보기</FooterLink>
            </FooterColumn>

            <FooterColumn title="사이트">
              <FooterLink href="/">홈</FooterLink>
              <FooterLink href="/games">게임</FooterLink>
              <FooterLink href="/about">소개</FooterLink>
            </FooterColumn>

            <FooterColumn title="바깥 링크">
              <FooterLink href="https://github.com/inhyk" external>
                GitHub
              </FooterLink>
            </FooterColumn>
          </div>

          <div className="mt-12 border-t border-border pt-6">
            <p className="text-xs text-muted">
              &copy; {new Date().getFullYear()} 인혁. 모든 권리 보유.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-foreground">{title}</p>
      <div className="mt-4 flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function FooterLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const props = external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <Link
      href={href}
      className="text-[13px] text-muted transition-colors hover:text-foreground"
      {...props}
    >
      {children}
    </Link>
  );
}
