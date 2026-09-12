import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export function Footer() {
  return (
    <footer id="contact" className="site-footer">
      <div className="site-container">
        <div className="footer-top">
          <div>
            <p className="section-kicker">
              THE NEXT LEVEL IS ALREADY IN THE MAKING
            </p>
            <h2>
              다음 상상도,
              <br className="sm:hidden" /> 함께 플레이해요<span>↗</span>
            </h2>
          </div>
          <Link
            href="/games"
            className="footer-play"
            aria-label="모든 게임 둘러보기"
          >
            <Icon name="arrow-up" width="32" height="32" />
          </Link>
        </div>
        <div className="footer-wordmark" aria-hidden="true">
          LET’S PLAY<span>!</span>
          <Icon name="spark" />
        </div>
        <div className="footer-bottom">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark">
              <Icon name="gamepad" width="20" height="20" />
            </span>
            <span className="brand-word">
              inhyuk<span>world</span>.
            </span>
          </Link>
          <p>작은 개발자의 끝없는 모험. © {new Date().getFullYear()} 인혁</p>
          <div>
            <Link href="/about">만든 사람</Link>
            <a
              href="https://github.com/inhyk"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
              <Icon name="arrow-up" width="13" height="13" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
