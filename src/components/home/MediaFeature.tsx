import Link from "next/link";
import { VideoEmbed } from "@/components/media/VideoEmbed";
import { mediaAppearances, formatMediaDate } from "@/data/media";
import { getGameBySlug } from "@/data/games";
import { Icon } from "@/components/ui/Icon";

const feature = mediaAppearances.find((item) => item.aspect === "landscape");
const shorts = mediaAppearances.filter((item) => item.aspect === "portrait");

export function MediaFeature() {
  if (!feature) return null;
  const relatedGame = feature.gameSlug
    ? getGameBySlug(feature.gameSlug)
    : undefined;
  return (
    <section id="media" className="media-section" aria-labelledby="media-title">
      <div className="site-container">
        <div className="section-heading">
          <div>
            <p className="section-kicker">
              <span className="section-number">02 /</span> BEHIND THE PLAY
            </p>
            <h2 id="media-title">플레이 뒤에 숨은 이야기</h2>
          </div>
          <span className="section-aside">
            만드는 순간도, 하나의 모험이니까요.
          </span>
        </div>
        <div className="media-grid">
          <article className="interview-card">
            <div className="interview-image">
              <VideoEmbed
                youtubeId={feature.youtubeId}
                title={feature.title}
                thumbnail={feature.thumbnail}
                aspect={feature.aspect}
                sizes="(max-width: 767px) 100vw, 740px"
              />
              <span className="media-image-label mono-label">
                IN CONVERSATION · {feature.outlet}
              </span>
            </div>
            <div className="interview-copy">
              <div className="media-meta">
                <span className="text-brand">INTERVIEW</span>
                <span>
                  {formatMediaDate(feature.publishedAt)} · {feature.duration}
                </span>
              </div>
              <h3>
                좋아하는 게임을 하다가,
                <br />
                나만의 게임을 만들기까지.
              </h3>
              <p>{feature.summary}</p>
              <div className="media-links">
                <a
                  href={feature.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link"
                >
                  인터뷰 전체 보기
                  <Icon name="arrow-up" width="16" height="16" />
                </a>
                {relatedGame && (
                  <Link
                    className="media-related"
                    href={`/games/${relatedGame.slug}`}
                  >
                    {relatedGame.title} 플레이
                    <Icon name="arrow" width="14" height="14" />
                  </Link>
                )}
              </div>
            </div>
          </article>
          <div id="shorts" className="shorts-panel">
            <div className="shorts-heading">
              <span className="mono-label">
                <span className="status-dot" /> DEV DIARY
              </span>
              <h3>아이디어가 게임이 되는 순간</h3>
              <p>
                직접 플레이하고, 말로 만들고.
                <br />
                짧은 영상으로 만나는 인혁이의 작업실.
              </p>
            </div>
            <div className="shorts-grid">
              {shorts.map((item) => (
                <article key={item.id}>
                  <VideoEmbed
                    youtubeId={item.youtubeId}
                    title={item.title}
                    thumbnail={item.thumbnail}
                    aspect={item.aspect}
                    sizes="(max-width: 767px) 45vw, 200px"
                  />
                  <span className="short-duration mono-label">
                    {item.duration}
                  </span>
                  <h4>{item.title}</h4>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
