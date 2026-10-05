import type { Metadata } from "next";
import Link from "next/link";
import { searchRobots } from "@/lib/site";

// 앱스토어 심사에 쓰는 「젤리 타워」 개인정보 처리방침. 앱이 실제로 하는 일과 똑같이 적는다.
export const metadata: Metadata = {
  title: { absolute: "젤리 타워 개인정보 처리방침 | 인혁이의 게임 월드" },
  description: "젤리 타워는 온라인 계정의 닉네임, 비밀번호 해시, 친구, 대화, 신고, 게임 저장만 서버에 저장합니다. 이메일, 전화번호, 위치는 받지 않습니다.",
  robots: searchRobots,
  alternates: { canonical: "/jelly-tower/privacy" },
};

const sections = [
  {
    title: "받지 않는 개인정보",
    body: [
      "젤리 타워는 진짜 이름, 이메일, 전화번호, 위치, 사진, 연락처를 묻거나 모으지 않습니다.",
      "광고, 사용자 추적, 분석 도구를 쓰지 않습니다.",
    ],
  },
  {
    title: "온라인 계정을 만들면 서버에 저장하는 것",
    body: [
      "닉네임과 비밀번호를 확인하기 위한 값(해시)을 저장합니다. 비밀번호 자체는 저장하지 않습니다. 이메일을 받지 않으므로 비밀번호를 잊으면 되찾을 수 없습니다.",
      "게임 저장(레벨·코인·스킨·타워·챌린지 기록)을 저장합니다. 다른 기기에서 같은 계정으로 로그인해 이어 하기 위해서입니다.",
      "친구 목록, 친구 요청, 차단 목록, 친구와 나눈 1:1 대화를 저장합니다. 상대가 접속해 있지 않아도 대화가 전해지게 하기 위해서입니다.",
      "온라인 대전 중 채팅은 저장하지 않고 상대에게 전하기만 합니다. 다만 신고를 확인하려고 각 대전 방의 최근 채팅 50줄을 대전이 끝나고 10분까지 기억합니다.",
      "신고가 들어오면 신고 내용과 그 대화 기록(1:1 대화는 마지막 50개, 대전은 그 방의 최근 채팅 50줄)을 보호자가 확인하도록 저장합니다.",
      "계정을 지키려고 로그인과 가입 시도 횟수를 인터넷 주소(IP)와 함께 잠깐 기록하고, 하루가 지나면 지웁니다. 정지한 계정을 대전에서 바로 내보내려고 하루 동안 들어간 대전 방 목록도 기억합니다. 계정 정지 같은 관리 기록도 남습니다.",
      "서버는 Cloudflare(net.seonn.workers.dev)에 있습니다.",
    ],
  },
  {
    title: "안전하게 이야기하기",
    body: [
      "채팅과 1:1 대화의 욕설, 전화번호, 링크, 메신저 아이디는 서버가 자동으로 가립니다. 이름, 학교, 전화번호 같은 개인정보는 보내지 말아 주세요.",
      "온라인 대전 채팅 창, 1:1 대화 화면, 대전 결과 화면의 [🚫 차단]을 누르면 그 사람과 친구가 끊기고, 서로 메시지를 보낼 수 없고, 다시 같이 매칭되지 않습니다. 상대에게는 알리지 않습니다.",
      "같은 곳의 [🚨 신고]를 누르면 보호자가 대화 기록을 확인하고, 필요하면 그 계정을 정지합니다.",
      "친구는 서로 수락해야 맺어지고, 1:1 대화는 친구끼리만 할 수 있습니다.",
    ],
  },
  {
    title: "기기 안에만 저장하는 것",
    body: [
      "손님으로 하거나 예전에 이 기기에서 만든 계정은 닉네임, 비밀번호 해시, 게임 기록이 기기 안에만 저장되고 서버로 보내지 않습니다. 온라인 대전과 친구 기능은 쓸 수 없습니다.",
      "기기 계정은 앱 안의 [내 정보 → 계정 지우기]를 누르거나 앱을 지우면 기기에서 모두 사라지고 되돌릴 수 없습니다. 온라인 계정으로 옮기면 그때부터 서버에 저장됩니다.",
      "[기록 코드 복사]는 사용자가 직접 복사해서 다른 기기에 붙여 넣을 때만 쓰이며, 우리에게 전송되지 않습니다.",
      "온라인 계정을 지우고 싶으면 아래 도움말에서 문의해 주세요. 앱 안에서 바로 지우는 기능은 준비 중입니다.",
    ],
  },
  {
    title: "어린이와 보호자께",
    body: [
      "젤리 타워는 어린이도 안전하게 즐길 수 있도록 진짜 이름이나 연락처를 받지 않고, 결제 기능이 없습니다.",
      "모르는 사람과 하는 「게임 찾기」와 채팅이 있습니다. 채팅은 자동으로 거르고, 차단과 신고를 언제든 할 수 있습니다.",
      "게임 안의 seonn 안내에서 [seonn.dev 구경하러 가기]를 누를 때만 사파리에서 인혁이의 게임 사이트가 열립니다.",
    ],
  },
];

export default function JellyTowerPrivacyPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-5 pt-24 pb-24 md:px-8">
      <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">젤리 타워 · JELLY TOWER</p>
      <h1 className="mt-3 text-[32px] leading-[1.15] font-extrabold tracking-[-0.03em] md:text-[42px]">개인정보 처리방침</h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-muted-strong">시행일: 2026년 10월 5일</p>
      <div className="mt-10 space-y-6">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <h2 className="text-[20px] font-bold tracking-[-0.02em]">{section.title}</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-[1.75] text-muted-strong">
              {section.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-10 text-[15px] leading-[1.7] text-muted-strong">
        궁금한 점은 <Link href="/jelly-tower" className="underline underline-offset-4">젤리 타워 도움말</Link>에서 확인하거나 문의해 주세요.
      </p>
    </div>
  );
}
