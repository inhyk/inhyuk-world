import type { Metadata } from "next";
import Link from "next/link";
import { searchRobots } from "@/lib/site";

// 앱스토어의 「지원 URL」로 쓰는 젤리 타워 도움말 페이지.
export const metadata: Metadata = {
  title: { absolute: "젤리 타워 도움말 | 인혁이의 게임 월드" },
  description: "같은 색 젤리 4개를 이어 터뜨리고 연쇄로 탑을 오르는 퍼즐 게임, 젤리 타워의 하는 법과 자주 묻는 질문.",
  robots: searchRobots,
  alternates: { canonical: "/jelly-tower" },
};

const faq = [
  ["어떻게 하나요?", "떨어지는 젤리 두 개를 옮기고 돌려서 같은 색 4개를 이어 붙이면 터져요. 터진 자리로 위의 젤리가 떨어져 또 터지면 연쇄! 메뉴의 [🐣 연습하기]에서 꼬마 젤리가 하나씩 알려 줘요."],
  ["기록을 다른 기기로 옮기고 싶어요", "[내 정보 → 기록 코드 복사]로 코드를 복사한 뒤, 다른 기기의 [기록 코드로 가져오기]에 붙여 넣고 같은 비밀번호로 로그인하세요."],
  ["계정을 지우고 싶어요", "[내 정보 → 계정 지우기]를 누르고 한 번 더 확인하면 그 계정의 기록이 기기에서 모두 사라져요."],
  ["진동이나 소리를 끄고 싶어요", "[내 정보 → 설정]에서 효과음, 배경음악, 진동을 각각 켜고 끌 수 있어요."],
  ["친구와 같이 할 수 있나요?", "한 기기에서 [2인 플레이]로 맵을 골라 함께 하거나, [온라인 대전]에서 방 코드를 친구에게 알려 주면 각자 기기로 대전할 수 있어요. 대전 중에는 💬 단추로 빠른 말이나 채팅을 보낼 수 있어요."],
  ["친구를 추가하고 채팅하고 싶어요", "[👫 친구]에서 내 친구 코드를 친구에게 알려 주고, 친구의 코드를 넣어 친구 신청을 해요. 친구가 받으면 서로 채팅하고 [🎮 같이 하기]로 대전에 초대할 수 있어요. 둘 다 게임을 켜 두었을 때만 이어져요."],
  ["채팅은 안전한가요?", "나쁜 말은 ♡로 가려지고 전화번호·이메일은 보낼 수 없어요. 대화는 서버에 저장되지 않아요. 싫은 친구는 [🚫 차단], 이상한 말은 [🚩 신고]로 대화를 복사해 어른께 보여 주세요. [내 정보 → 설정]에서 채팅을 끌 수도 있어요."],
];

export default function JellyTowerSupportPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-5 pt-24 pb-24 md:px-8">
      <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">JELLY TOWER</p>
      <h1 className="mt-3 text-[32px] leading-[1.15] font-extrabold tracking-[-0.03em] md:text-[42px]">젤리 타워 도움말</h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-muted-strong">
        같은 색 젤리를 이어 터뜨리고, 연쇄로 상대에게 방해 젤리를 보내며 탑 꼭대기와 우주 너머까지 오르는 퍼즐 게임이에요. 초등학생 게임 개발자 인혁이 기획했어요.
      </p>
      <div className="mt-10 space-y-4">
        {faq.map(([q, a]) => (
          <section key={q} className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-[18px] font-bold tracking-[-0.02em]">{q}</h2>
            <p className="mt-2 text-[15px] leading-[1.75] text-muted-strong">{a}</p>
          </section>
        ))}
      </div>
      <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-[18px] font-bold tracking-[-0.02em]">문의하기</h2>
        <p className="mt-2 text-[15px] leading-[1.75] text-muted-strong">
          버그나 하고 싶은 말이 있으면{" "}
          <a href="https://github.com/inhyk/inhyuk-world/issues" className="underline underline-offset-4">GitHub 이슈</a>
          에 남겨 주세요.
        </p>
      </div>
      <p className="mt-8 text-[15px] leading-[1.7] text-muted-strong">
        <Link href="/jelly-tower/privacy" className="underline underline-offset-4">개인정보 처리방침</Link>
        {" · "}
        <Link href="/play/puyo-puyo" className="underline underline-offset-4">웹에서 바로 해 보기</Link>
      </p>
    </div>
  );
}
