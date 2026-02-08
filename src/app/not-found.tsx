import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 pt-16">
      <h1 className="font-[family-name:var(--font-dm-sans)] text-8xl font-black tracking-[-0.07em] text-lavender">
        404
      </h1>
      <p className="mt-4 text-lg text-muted">페이지를 찾을 수 없습니다</p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-all hover:bg-lavender hover:scale-105"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
