import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 pt-16 text-center">
      <span className="font-[family-name:var(--font-inter-tight)] text-[96px] leading-none font-extrabold tracking-[-0.04em] text-foreground/10 md:text-[140px]">
        404
      </span>
      <p className="mt-4 font-[family-name:var(--font-inter-tight)] text-xl font-bold tracking-[-0.02em]">
        페이지를 찾을 수 없습니다
      </p>
      <p className="mt-2 text-sm text-muted">주소를 다시 확인해 주세요</p>
      <div className="mt-8">
        <Button href="/">홈으로 →</Button>
      </div>
    </div>
  );
}
