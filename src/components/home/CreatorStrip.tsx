import Link from "next/link";
import { games } from "@/data/games";
import { Icon } from "@/components/ui/Icon";

export function CreatorStrip() {
  return (
    <section
      className="creator-section site-container"
      aria-labelledby="creator-title"
    >
      <div className="creator-panel">
        <div className="creator-art" aria-hidden="true">
          <div className="creator-orbit" />
          <div className="creator-code">
            &lt;<span>i</span>/&gt;
          </div>
          <span className="creator-note mono-label">PLAYER → CREATOR</span>
          <Icon name="spark" className="creator-spark" width="36" height="36" />
        </div>
        <div className="creator-copy">
          <p className="section-kicker">
            <span className="section-number">03 /</span> MEET THE MAKER
          </p>
          <h2 id="creator-title">
            “이런 게임 있으면 좋겠다.”
            <br />
            그래서 직접 만들었어요.
          </h2>
          <p>
            안녕하세요, 게임을 좋아해서 게임을 만드는 인혁입니다.
            <br className="hidden lg:block" /> 작은 호기심이 {games.length}개의
            게임이 되었고, 다음 모험은 지금도 만드는 중이에요.
          </p>
          <Link href="/about" className="text-link">
            인혁이의 이야기
            <Icon name="arrow-up" width="18" height="18" />
          </Link>
        </div>
        <span className="creator-corner mono-label" aria-hidden="true">
          ALWAYS CURIOUS ↗
        </span>
      </div>
    </section>
  );
}
