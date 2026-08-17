import { ImageResponse } from "next/og";

export const socialImageSize = {
  width: 1200,
  height: 630,
};

export const socialImageContentType = "image/png";

export function createSocialImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          backgroundColor: "#08080b",
          backgroundImage:
            "radial-gradient(circle at 10% 10%, #3b82f6 0%, transparent 42%), radial-gradient(circle at 88% 82%, #ec4899 0%, transparent 40%), radial-gradient(circle at 55% 45%, #7c3aed 0%, transparent 48%)",
          color: "#f5f5f7",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "64px 72px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 999,
              height: 14,
              marginRight: 14,
              width: 14,
            }}
          />
          seonn.dev
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 82,
              fontWeight: 800,
              letterSpacing: "-0.045em",
              lineHeight: 1.08,
            }}
          >
            인혁이의 게임 월드
          </div>
          <div
            style={{
              color: "rgba(245, 245, 247, 0.78)",
              display: "flex",
              fontSize: 31,
              marginTop: 24,
            }}
          >
            초등학생 게임 개발자 인혁의 웹 게임 포트폴리오
          </div>
        </div>

        <div
          style={{
            color: "rgba(245, 245, 247, 0.82)",
            display: "flex",
            fontSize: 22,
            gap: 28,
            letterSpacing: "0.025em",
          }}
        >
          <span>액션</span>
          <span>퍼즐</span>
          <span>시뮬레이션</span>
        </div>
      </div>
    ),
    socialImageSize
  );
}
