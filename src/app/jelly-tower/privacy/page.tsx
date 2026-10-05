import type { Metadata } from "next";
import Link from "next/link";
import { searchRobots } from "@/lib/site";

// 앱스토어 심사에 쓰는 「젤리 타워」 개인정보 처리방침. 앱이 실제로 하는 일과 똑같이 적는다.
export const metadata: Metadata = {
  title: { absolute: "젤리 타워 개인정보 처리방침 | 인혁이의 게임 월드" },
  description: "젤리 타워 앱은 개인정보를 모으지 않습니다. 게임 기록은 기기 안에만 저장됩니다.",
  robots: searchRobots,
  alternates: { canonical: "/jelly-tower/privacy" },
};

const sections = [
  {
    title: "개인정보는 모으지 않아요",
    body: [
      "젤리 타워는 이름, 이메일, 전화번호, 위치, 사진, 연락처 같은 개인정보를 모으지 않습니다.",
      "친구 기능을 쓸 때만, 친구에게 보낸 메시지가 전달될 때까지 친구 우체통에 잠깐 맡겨집니다 (아래 「친구 채팅과 친구 우체통」).",
      "광고, 사용자 추적, 분석 도구를 쓰지 않습니다.",
    ],
  },
  {
    title: "게임 기록은 기기 안에만 저장돼요",
    body: [
      "닉네임, 비밀번호를 확인하기 위한 값(해시), 레벨·코인·스킨·타워·챌린지 기록은 이 기기 안에만 저장됩니다. 비밀번호 자체는 저장하지 않습니다.",
      "앱 안의 [내 정보 → 계정 지우기]를 누르거나 앱을 지우면 기록이 기기에서 모두 사라지고 되돌릴 수 없습니다.",
      "[기록 코드 복사]는 사용자가 직접 복사해서 다른 기기에 붙여 넣을 때만 쓰이며, 우리에게 전송되지 않습니다.",
    ],
  },
  {
    title: "친구 채팅과 친구 우체통",
    body: [
      "친구는 각 계정의 6글자 친구 코드를 서로 넣어서 맺습니다. 친구 목록, 차단 목록, 친구마다 최근 대화 50개는 이 기기 안에만 저장됩니다.",
      "친구가 게임을 꺼 두었어도 받을 수 있도록, 친구에게 보낸 메시지·젤리 이모티콘·친구 신청은 사이트(seonn.dev)의 「친구 우체통」에 맡깁니다. 우체통 저장소는 Upstash Redis(미국 동부)입니다.",
      "우체통에 맡기는 것: 보낸 사람과 받는 사람의 친구 코드, 닉네임, 레벨, 메시지 글이나 이모티콘 번호, 보낸 시각. 친구가 게임을 켜서 받아 가면 바로 지우고, 받아 가지 않아도 7일 뒤 저절로 지웁니다.",
      "우체통을 여는 열쇠는 기기에만 있고 서버에는 열쇠를 알아볼 수 없게 바꾼 값(해시)만 있어서, 다른 사람인 척 보내거나 남의 편지를 열 수 없습니다. [계정 지우기]를 하면 우체통과 열쇠도 지웁니다.",
      "맡긴 편지는 친구에게 전달하는 데만 쓰고, 광고·분석에 쓰거나 다른 곳에 주지 않습니다. 둘 다 게임을 켜 두었을 때의 대전 초대와 「게임 중」 표시는 두 기기 사이로 바로 갑니다.",
      "나쁜 말은 보내기 전, 우체통, 받을 때 모두 ♡로 가려지고, 전화번호와 이메일은 보낼 수 없습니다. 너무 많이 보내면 잠시 막히고, 원하지 않는 친구는 차단할 수 있고, 설정에서 채팅을 끌 수 있습니다.",
      "[신고]를 누르면 최근 대화가 복사됩니다. 어른께 보여 드리고 젤리 타워 도움말 페이지의 문의하기로 알려 주세요.",
    ],
  },
  {
    title: "온라인 대전·친구 기능을 쓸 때만 인터넷을 써요",
    body: [
      "방 코드로 친구와 대전할 때는 두 기기를 직접 연결하기 위해 PeerJS 연결 서버(0.peerjs.com)와 연결 도우미 서버(stun.l.google.com, turn.peerjs.com)를 사용합니다. 이때 기기의 인터넷 주소(IP)가 연결을 위해 쓰일 수 있습니다.",
      "친구 기능을 쓰는 동안에는 친구가 나에게 연결할 수 있도록 친구 코드로 같은 연결 서버에 이어 두고, 친구 우체통(seonn.dev)을 가끔 열어 새 편지가 왔는지 봅니다.",
      "대전 중에는 닉네임, 레벨, 고른 스킨, 게임 움직임, 채팅만 상대 기기로 바로 전달되며, 우리는 이를 저장하지 않습니다.",
      "온라인 대전과 친구 기능을 쓰지 않으면 인터넷에 연결하지 않습니다.",
    ],
  },
  {
    title: "어린이와 보호자께",
    body: [
      "젤리 타워는 어린이도 안전하게 즐길 수 있도록 개인정보를 받지 않고, 결제 기능이 없습니다. 친구 채팅은 친구 코드를 서로 아는 사람끼리만 됩니다.",
      "게임 안의 seonn 안내에서 [seonn.dev 구경하러 가기]를 누를 때만 사파리에서 인혁이의 게임 사이트가 열립니다.",
    ],
  },
];

export default function JellyTowerPrivacyPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-5 pt-24 pb-24 md:px-8">
      <p className="text-xs font-medium tracking-[0.14em] text-muted uppercase">젤리 타워 · JELLY TOWER</p>
      <h1 className="mt-3 text-[32px] leading-[1.15] font-extrabold tracking-[-0.03em] md:text-[42px]">개인정보 처리방침</h1>
      <p className="mt-4 text-[15px] leading-[1.7] text-muted-strong">시행일: 2026년 10월 5일 (친구 우체통 추가)</p>
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
