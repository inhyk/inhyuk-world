import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 pt-16">
      <h1 className="font-[family-name:var(--font-playfair)] text-[10rem] font-bold leading-none text-foreground/8 md:text-[12rem]">
        404
      </h1>
      <p className="mt-2 text-xl text-muted-strong md:text-2xl">
        페이지를 찾을 수 없습니다
      </p>
      <Link
        href="/"
        className="mt-10 text-sm text-foreground underline underline-offset-4 decoration-foreground/20 transition-colors hover:decoration-foreground/60"
      >
        홈으로 &rarr;
      </Link>
    </div>
  );
}
