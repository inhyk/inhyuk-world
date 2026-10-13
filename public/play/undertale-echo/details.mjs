// Optional, original environmental stories. They never change route or combat state.
const detail = (id, room, x, y, kind, title, lines, repeat, extra = {}) => ({ id, room, x, y, kind, title, lines, repeat, solid: !['flowers', 'footprints', 'water', 'plaque'].includes(kind), ...extra });
export const DETAILS = [
  detail('first-flowers', 'ruins_flowerbed', 9, 8, 'flowers', '꽃이 받아 준 자리', ['* 납작해진 꽃들이 천천히 고개를 든다.', '* 누군가 떨어질 때마다, 이 작은 꽃밭은 다시 일어났을까?', '* 꽃잎 하나를 마음속 수첩에 끼워 두었다.'], ['* 눌렸던 꽃잎 사이로 새 꽃봉오리가 보인다.']),
  detail('ruins-plaque', 'ruins_entry', 12, 5, 'plaque', '지워지지 않은 환영', ['* 낡은 돌판에 작은 글씨가 남아 있다.', '* "처음 오는 손님에게는, 문보다 마음을 먼저 열어 줄 것."', '* 마지막 문장만 유난히 반들반들하다.'], ['* 누군가 손끝으로 몇 번이고 따라 읽은 문장이다.']),
  detail('dummy-thread', 'ruins_dummy', 9, 3, 'basket', '누군가의 바느질', ['* 실과 솜이 담긴 바구니다. 보라색 실이 제일 짧다.', '* 인형의 찢어진 곳은 매번 다른 색으로 꿰매져 있다.', '* 다친 것을 고치는 일에도 연습이 필요한가 보다.'], ['* 바늘 끝에 아직 짧은 보라색 실이 매달려 있다.']),
  detail('leaf-bench', 'ruins_leaves', 3, 2, 'bench', '낙엽의 특등석', ['* 작은 벤치에 앉아 낙엽을 바라보았다.', '* 아무것도 하지 않는 동안에도, 낙엽은 꽤 바쁘다.'], ['* 이번엔 빨간 잎이 먼저 도착했다.']),
  detail('home-books', 'ruins_home', 5, 2, 'bookshelf', '책갈피 사이의 메모', ['* 요리책 옆에 어린이를 위한 퍼즐 책이 꽂혀 있다.', '* "오늘은 조금 더 쉬운 문제부터." 동그란 글씨로 적힌 메모다.'], ['* 책 모서리는 여러 번 접었다 편 흔적으로 부드러워졌다.'], { dark: ['* 책은 여전히 같은 쪽에 펼쳐져 있다.', '* 이제 다음 문제를 골라 줄 사람은 없다.'] }),
  detail('home-pie', 'ruins_home', 7, 5, 'table', '한 사람 몫의 파이', ['* 작은 접시와 포크가 가지런히 놓여 있다.', '* 파이의 김이 안경도 없는 당신의 시야를 흐린다.', '* 누군가는 당신이 여기 머무를 거라고 생각한 것 같다.'], ['* 접시 옆 종이에는 "천천히 먹으렴"이라고 적혀 있다.'], { dark: ['* 파이는 식었다.', '* 한 사람 몫의 접시가 그대로 남아 있다.'] }),
  detail('home-fire', 'ruins_home', 15, 4, 'fireplace', '돌아올 수 있는 온기', ['* 장작이 작게 톡, 하고 소리를 냈다.', '* 잠깐만 더 여기 있어도 괜찮을 것 같다.'], ['* 불빛이 당신의 신발 끝까지 닿는다.']),
  detail('home-bed', 'ruins_home', 14, 8, 'bed', '정돈된 이불', ['* 이불 아래에 따뜻한 물주머니가 들어 있다.', '* 베개 옆에는 새 칫솔이 하나 놓여 있다.', '* 손님이 아니라, 가족을 맞이하는 준비다.'], ['* 이불 모서리가 아주 반듯하게 접혀 있다.']),
  detail('snow-snowman', 'snow_forest', 3, 5, 'snowman', '녹지 않는 인사', ['* 눈사람이 나뭇가지 손을 들고 있다.', '* 바람이 불 때마다, 아주 조금씩 손을 흔드는 것 같다.', '* 당신도 손을 흔들었다. 조금 추웠다.'], ['* 눈사람은 여전히 열심히 인사하는 중이다.']),
  detail('snow-spaghetti', 'snow_papyrus', 4, 2, 'table', '자신감 한 접시', ['* 스파게티 옆에 큼지막한 쪽지가 놓여 있다.', '* "시식 전에 감탄할 시간을 충분히 가질 것! — 위대한 요리사"', '* 포크는 얼어붙었다. 자신감은 멀쩡하다.'], ['* 쪽지 뒷면에 "맛이 없어도 친구는 될 수 있다"라고 작게 적혀 있다.']),
  detail('snow-sign', 'snow_town', 8, 5, 'sign', '설원의 게시판', ['* "잃어버린 장갑 한 짝을 찾습니다."', '* 그 아래: "장갑은 못 찾았지만 여분은 있어요."', '* 서로 다른 글씨가 하나의 대화를 만들었다.'], ['* 새 쪽지에는 "고마워요. 정말 따뜻해요."라고 쓰여 있다.']),
  detail('snow-lamp', 'snow_town', 15, 8, 'lamp', '밤을 위한 불빛', ['* 가로등 아래 눈만 유난히 얇다.', '* 모르는 사람의 발길을 위해 누군가는 매일 불을 켠다.'], ['* 불빛 안에서 눈송이가 잠깐 금색이 된다.']),
  detail('water-telescope', 'water_entry', 9, 4, 'telescope', '빌려 보는 하늘', ['* 망원경 안에는 보석 박힌 천장이 보인다.', '* 진짜 별을 본 적 없는 사람이, 별자리를 그려 놓았다.', '* 이름은 "집으로 가는 길"이다.'], ['* 가장 작은 별 옆에 당신만 아는 이름을 붙였다.']),
  detail('water-music', 'water_tem', 3, 2, 'musicbox', '물에 젖은 멜로디', ['* 오래된 오르골의 태엽을 조심스럽게 돌렸다.', '* 마지막 음 하나가 빠져 있다.', '* 당신이 작게 흥얼거리자 곡이 끝났다.'], ['* 이번에는 빠진 음을 기억하고 있다.']),
  detail('water-wish', 'water_echo', 12, 9, 'flowers', '꽃이 기억하는 말', ['* 꽃에 아주 작은 목소리로 소원을 말했다.', '* 메아리는 재촉하지 않고 끝까지 들어 주었다.', '* "무사히 돌아갈 수 있으면 좋겠어."'], ['* 꽃이 당신의 소원을 되돌려 준다.', '* 처음보다 조금 덜 외롭게 들린다.']),
  detail('hot-monitor', 'hot_lab', 11, 4, 'monitor', '보내지 못한 응원', ['* 모니터에는 전송하지 않은 문장이 가득하다.', '* "조심해." "너라면 할 수 있어." "혹시 도움이 필요하면…"', '* 커서는 마지막 문장 뒤에서 깜빡인다.'], ['* 응원은 이미 충분히 전해진 것 같다.']),
  detail('hot-cooler', 'hot_lab', 6, 9, 'cooler', '차가운 배려', ['* 물통에 "누구든 마셔도 됩니다"라고 쓰여 있다.', '* 종이컵 하나마다 웃는 얼굴이 그려져 있다.', '* 가장 삐뚤어진 얼굴이 제일 다정해 보인다.'], ['* 당신도 빈 컵 하나에 웃는 얼굴을 그렸다.']),
  detail('stage-mirror', 'hot_stage', 15, 5, 'mirror', '무대 뒤의 연습', ['* 거울 모서리에 작은 별 스티커가 붙어 있다.', '* "관객이 한 명이어도 최고의 쇼를."', '* 당신은 잠깐 멋진 포즈를 취했다. 거울도 잘 따라 했다.'], ['* 두 번째 포즈는 조금 더 자연스러웠다.']),
  detail('castle-photo', 'castle_home', 11, 3, 'frame', '먼지 없는 사진틀', ['* 사진은 오래되었지만 액자에는 먼지가 없다.', '* 두 아이가 웃고 있다. 누군가 사진을 자주 닦는 모양이다.', '* 행복했던 순간은, 작은 사각형 안에도 오래 남는다.'], ['* 사진 속 웃음은 조금도 바뀌지 않았다.']),
  detail('castle-clock', 'castle_home', 5, 9, 'clock', '멈춰 둔 시간', ['* 시계는 멈췄다. 하지만 태엽은 매일 감은 흔적이 있다.', '* 누군가는 시간이 흐르는 것과 앞으로 나아가는 것을 구분하고 있다.'], ['* 잠깐, 당신의 심장 소리만 들린다.']),
  detail('castle-plaque', 'castle_hall', 4, 5, 'plaque', '빛이 닿는 자리', ['* 유리창의 색이 손바닥 위로 내려앉았다.', '* 여기에 오기까지 만난 얼굴들이 떠오른다.', '* 당신이 남긴 것은 발자국만이 아니다.'], ['* 빛은 누구의 손 위에나 같은 색으로 내려앉는다.'], { violent: ['* 창문은 여전히 밝다.', '* 길 위의 발자국은, 이제 당신 것뿐이다.'] }),
  detail('king-tea', 'castle_throne', 15, 9, 'table', '두 잔의 차', ['* 작은 탁자에 찻잔이 두 개 놓여 있다.', '* 하나는 손잡이가 닳았고, 하나는 아직 새것 같다.', '* 이곳에서도 누군가는 손님을 기다렸다.'], ['* 차 향기 사이로 꽃 냄새가 섞여 온다.']),
];

export const detailsFor = room => DETAILS.filter(item => item.room === (typeof room === 'string' ? room : room.id));
export function journalFor(player) {
  player.journal ??= { entries: [], inspected: {} };
  player.journal.entries ??= [];
  player.journal.inspected ??= {};
  return player.journal;
}
export function inspectDetail(player, item) {
  const journal = journalFor(player);
  const count = journal.inspected[item.id] || 0;
  const first = count === 0;
  journal.inspected[item.id] = count + 1;
  const dark = item.dark && player.bossFate?.toriel === 'killed';
  const violent = item.violent && player.kills > 0;
  const lines = [...(dark ? item.dark : violent ? item.violent : count ? item.repeat : item.lines)];
  if (first) journal.entries.push({ id: item.id, room: item.room, title: item.title, lines: [...lines] });
  return { lines, first, title: item.title };
}
