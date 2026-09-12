// 언더테일 팬 게임 · 픽셀 스프라이트 (문자 격자로 그린 원본 픽셀 아트)
// '.' 은 투명. 팔레트 글자는 각 스프라이트의 palette에서 색으로 바뀐다.
const P = { k: '#101010', w: '#ffffff', g: '#9a9a9a', d: '#4a4a4a', s: '#f2cfa8', h: '#5b3a1f', b: '#3b4fd0', p: '#a24fd8', t: '#7a4a2a', y: '#f4d34a', o: '#f08a24', r: '#e8302a', n: '#f7a8c8', c: '#4ec8ff', l: '#7bd76b', v: '#3e2a7e', m: '#ff7ad0', e: '#1c1c2e', q: '#c9c9ff', i: '#ffd6e0', u: '#5e6bff', a: '#c88b58', z: '#2c9c3e', f: '#ffe680', x: '#8d6ac7' };

const mirror = rows => rows.map(r => r.split('').reverse().join(''));
const def = (rows, palette = {}) => ({ rows, palette: { ...P, ...palette }, w: rows[0].length, h: rows.length });

// ---------- 인간 (프리스크) 16x22 ----------
const humanDown = [
  '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhssssssss...', '...hsssssssss...', '...hsskssksss...', '....ssssssss....', '....ssssssss....', '.....ssssss.....',
  '....bbbbbbbb....', '...bbppppppbb...', '...bbbbbbbbbb...', '..sbppppppppbs..', '..sbbbbbbbbbbs..', '...bbbbbbbbbb...', '....tttttttt....', '....tttttttt....', '....ttt..ttt....', '....ttt..ttt....', '....ttt..ttt....', '...hhh....hhh...', '...hhh....hhh...'];
const humanDown2 = humanDown.map((r, i) => i >= 17 ? (i === 17 ? '....ttt..ttt....' : i === 18 ? '...ttt....ttt...' : i === 19 ? '..ttt......ttt..' : i === 20 ? '..hhh......hhh..' : '.hhh........hhh.') : r);
const humanUp = [
  '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '....hhhhhhhh....', '....ssssssss....', '.....ssssss.....',
  '....bbbbbbbb....', '...bbppppppbb...', '...bbbbbbbbbb...', '..sbppppppppbs..', '..sbbbbbbbbbbs..', '...bbbbbbbbbb...', '....tttttttt....', '....tttttttt....', '....ttt..ttt....', '....ttt..ttt....', '....ttt..ttt....', '...hhh....hhh...', '...hhh....hhh...'];
const humanUp2 = humanUp.map((r, i) => i >= 17 ? humanDown2[i] : r);
const humanLeft = [
  '.....hhhhhh.....', '....hhhhhhhh....', '...hhhhhhhhhh...', '...hhhhsssss....', '...hhhhsssss....', '...hhhhkssss....', '....hhsssss.....', '....hhsssss.....', '.....sssss......',
  '....bbbbbbb.....', '....bpppppb.....', '....bbbbbbb.....', '....bpppppbs....', '....bbbbbbbs....', '....bbbbbbb.....', '....ttttttt.....', '....ttttttt.....', '....ttttttt.....', '.....ttttt......', '.....ttttt......', '....hhhhhh......', '....hhhhhh......'];
const humanLeft2 = humanLeft.map((r, i) => i >= 17 ? (i === 17 ? '...tttt.ttt.....' : i === 18 ? '..ttt....ttt....' : i === 19 ? '..ttt....ttt....' : i === 20 ? '.hhh......hhh...' : '.hhh......hhh...') : r);
export const HUMAN = { down: [def(humanDown), def(humanDown2)], up: [def(humanUp), def(humanUp2)], left: [def(humanLeft), def(humanLeft2)], right: [def(mirror(humanLeft)), def(mirror(humanLeft2))] };
// 차라 (몰살 결말용): 초록 줄무늬
export const CHARA = def(humanDown.map(r => r.replace(/b/g, 'z').replace(/p/g, 'y').replace(/s/g, 'i')));

// ---------- 플라위 16x18 ----------
export const FLOWEY = def([
  '.....yyyyyy.....', '...yyyyyyyyyy...', '..yyy......yyy..', '.yy..wwwwww..yy.', '.yy.wwwwwwww.yy.', 'yy..wkwwwwkw..yy', 'yy..wwwwwwww..yy', 'yy..wkwwwwkw..yy', 'yy..wwkkkkww..yy', '.yy..wwwwww..yy.', '.yy..........yy.', '..yyy......yyy..', '...yyyyyyyyyy...', '.....yyzzyy.....', '.......zz.......', '.....zzzz.......', '.......zz..zz...', '.......zzzz.....']);
export const FLOWEY_EVIL = def([
  '.....yyyyyy.....', '...yyyyyyyyyy...', '..yyy......yyy..', '.yy..kkkkkk..yy.', '.yy.kkkkkkkk.yy.', 'yy..krkkkkrk..yy', 'yy..kkkkkkkk..yy', 'yy..kwwwwwwk..yy', 'yy..kwkwkwwk..yy', '.yy..kkkkkk..yy.', '.yy..........yy.', '..yyy......yyy..', '...yyyyyyyyyy...', '.....yyzzyy.....', '.......zz.......', '.....zzzz.......', '.......zz..zz...', '.......zzzz.....']);

// ---------- 토리엘 18x30 ----------
export const TORIEL = def([
  '...ww........ww...', '..wwww......wwww..', '..wwwwwwwwwwwwww..', '...wwwwwwwwwwww...', '...wwwwwwwwwwww...', '...wwkwwwwwwkww...', '...wwwwwwwwwwww...', '....wwwwwwwwww....', '....wwwwkkwwww....', '.....wwwwwwww.....',
  '....vvvvvvvvvv....', '...vvvvvvvvvvvv...', '..vvvvvvvvvvvvvv..', '..vvvvxxxxxxvvvv..', '..vvvvxvvvvxvvvv..', '..vvvvvxvvxvvvvv..', '..vvvvvvxxvvvvvv..', 'wwvvvvvvvvvvvvvvww', 'wwvvvvvvvvvvvvvvww', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..', '..vvvvvvvvvvvvvv..']);

// ---------- 샌즈 16x22 ----------
export const SANS = def([
  '....wwwwwwww....', '...wwwwwwwwww...', '..wwwwwwwwwwww..', '..wwkkwwwwkkww..', '..wwkwwwwwwkww..', '..wwwwwwwwwwww..', '..wwkkkkkkkkww..', '...wwkwkwkwkw...', '....wwwwwwww....',
  '...bbbbbbbbbb...', '..bbwwbbbbwwbb..', '..bbbbwwwwbbbb..', '.bbbbwwwwwwbbbb.', '.bbbbwwwwwwbbbb.', '..bbbbwwwwbbbb..', '...bbbbbbbbbb...', '...kkkkkkkkkk...', '...kkkk..kkkk...', '...kkkk..kkkk...', '...kkkk..kkkk...', '..nnnn....nnnn..', '..nnnn....nnnn..']);
export const SANS_DARK = def(SANS.rows.map((r, i) => i === 3 ? '..wwkkwwwwkkww..' : i === 4 ? '..wwkcwwwwkkww..' : r));

// ---------- 파피루스 14x32 ----------
export const PAPYRUS = def([
  '....wwwwww....', '...wwwwwwww...', '...wwwwwwww...', '...wkkwwkkw...', '...wkkwwkkw...', '...wwwwwwww...', '...wwwwwwww...', '...wkkkkkkw...', '...wwkwkwww...', '....wwwwww....',
  '...rrrrrrrr...', '..rrrrrrrrrr..', '.rrrrrrrrrrrr.', '..wwwwwwwwww..', '.wwwwwwwwwwww.', 'wwwwwwwwwwwwww', 'wwwwwwwwwwwwww', 'wwwwrrrrrrwwww', 'wwwwrrrrrrwwww', '.wwwwwwwwwwww.', '.rwwwwwwwwwwr.', '.r.wwwwwwww.r.', '.r.bbbbbbbb.r.', '.r.bbbbbbbb.r.', '.r.bbbbbbbb.r.', '.r.bbbb.bbbb..', '...bbbb.bbbb..', '...bbbb.bbbb..', '...bbbb.bbbb..', '..rrrr...rrrr.', '..rrrr...rrrr.', '..rrrr...rrrr.']);

// ---------- 언다인 16x30 ----------
export const UNDYNE = def([
  '..rrrrrrrrrr....', '.rrrrrrrrrrrr...', 'rrrrrrrrrrrrrr..', 'rrrccccccccrrr..', 'rrccccccccccrr..', 'rrcckcccckccrr..', 'rrcccccccccrr...', 'rrccccccccccrr..', '.rrcckkkkkccrr..', '..rrcccccccrr...', '...rrrrrrrr.....', '....gggggg......', '...gggggggg.....', '..gggggggggg....', '.gggggggggggg...', '.ggg.gggggg.ggg.', '.ggg.gggggg.ggg.', '.ggg.gggggg.ggg.', '.ccc.gggggg.ccc.', '.....gggggg.....', '.....gggggg.....', '.....gggggg.....', '.....ggg.ggg....', '.....ggg.ggg....', '.....ggg.ggg....', '.....ggg.ggg....', '....gggg.gggg...', '....gggg.gggg...', '....kkkk.kkkk...', '....kkkk.kkkk...']);
export const UNDYING = def(UNDYNE.rows.map(r => r.replace(/g/g, 'e')), { e: '#2c2c44', c: '#3aa0ff' });

// ---------- 몬스터 키드 14x20 ----------
export const KID = def([
  '.....yyyy.....', '....yyyyyy....', '...yyyyyyyy...', '...ykyyyyky...', '...yyyyyyyy...', '...yyykkyyy...', '....yyyyyy....', '....oooooo....', '...oooyyyooo..', '...ooooooooo..', '...oooyyyooo..', '...ooooooooo..', '...oooyyyooo..', '....oooooo....', '....yyyyyy....', '....yyyyyy....', '....yy..yy....', '....yy..yy....', '...yyy..yyy...', '...yyy..yyy...']);

// ---------- 상점 토끼 16x24 ----------
export const RABBIT = def([
  '...pp......pp...', '..ppp......ppp..', '..ppp......ppp..', '..ppp......ppp..', '..pppppppppppp..', '.pppppppppppppp.', '.ppkppppppppkpp.', '.pppppppppppppp.', '.pppppppkppppppp', '..pppppppppppp..', '...pppppppppp...', '....ffffffff....', '...ffffffffff...', '..ffffffffffff..', '..ffffffffffff..', '..ffffffffffff..', '..ffffffffffff..', '..ffffffffffff..', '..ffffffffffff..', '...ffffffffff...', '....pppppppp....', '....ppp..ppp....', '....ppp..ppp....', '....ppp..ppp....'], { p: '#c9a0e8', f: '#f0e0c0' });

// ---------- 템미 18x14 ----------
export const TEMMIE = def([
  '..ww..........ww..', '..www........www..', '..wwwwwwwwwwwwww..', '..wwwwwwwwwwwwww..', '.wwwkwwwwwwwwkwww.', '.wwwwwwwwwwwwwwww.', '.wwwwwkwwwwkwwwww.', '..wwwwwkkkkwwwww..', '...wwwwwwwwwwww...', '....bbbbbbbbbb....', '....bbbbbbbbbb....', '....bbbbbbbbbb....', '....ww..ww..ww....', '....ww..ww..ww....']);

// ---------- 냅스타블룩 14x20 ----------
export const BLOOK = def([
  '.....wwww.....', '...wwwwwwww...', '..wwwwwwwwww..', '..wwwwwwwwww..', '.wwwwwwwwwwww.', '.wwkkwwwwkkww.', '.wwkkwwwwkkww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwkkkkwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '..w.ww..ww.w..', '..w.ww..ww.w..', '.....w..w.....']);

// ---------- 메아리 꽃 12x16 ----------
export const ECHO = def([
  '....cccc....', '...cccccc...', '..cccqqccc..', '..ccqqqqcc..', '..ccqqqqcc..', '..cccqqccc..', '...cccccc...', '....cccc....', '.....zz.....', '.....zz.....', '..zz.zz.....', '...zzzz.....', '.....zz.zz..', '.....zzzz...', '.....zz.....', '.....zz.....']);

// ---------- 자판기 16x24 ----------
export const VENDING = def([
  'mmmmmmmmmmmmmmmm', 'mwwwwwwwwwwwwwwm', 'mwmmmmmmmmmmmmwm', 'mwwwwwwwwwwwwwwm', 'mmmmmmmmmmmmmmmm', 'mkkkkkkkkkkkkmmm', 'mkyykkookkppkmmm', 'mkyykkookkppkmmm', 'mkkkkkkkkkkkkmmm', 'mkccKkllkkyykmwm', 'mkcckkllkkyykmwm', 'mkkkkkkkkkkkkmmm', 'mkmmkkrrkkwwkmmm', 'mkmmkkrrkkwwkmmm', 'mkkkkkkkkkkkkmmm', 'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmmmmmmm', 'mmmkkkkkkkkkkmmm', 'mmmkkkkkkkkkkmmm', 'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmmmmmmm', 'mmmmmmmmmmmmmmmm', 'kkkkkkkkkkkkkkkk', 'kkkkkkkkkkkkkkkk'], { K: '#4ec8ff' });

// ---------- 아스고어 22x36 ----------
export const ASGORE = def([
  '..yyy..........yyy....', '.yyyy..........yyyy...', 'yyyy....wwww....yyyy..', 'yyy...wwwwwwww...yyy..', 'yy...wwwwwwwwww...yy..', '.....wwwwwwwwww.......', '.....wwkwwwwkww.......', '.....wwwwwwwwww.......', '.....wwwwwwwwww.......', '......yyyyyyyy........', '......yyyyyyyy........', '......yyyyyyyy........', '....vvvvvvvvvvvv......', '...vvvvvvvvvvvvvv.....', '..vvvvvvvvvvvvvvvv....', '.vvvvvvvxxxxvvvvvvv...', 'vvvvvvvvxxxxvvvvvvvv..', 'vvvvvvvvvxxvvvvvvvvv..', 'vvvvvvvvvvvvvvvvvvvv..', 'vvvgggvvvvvvvvvgggvv..', 'vvvgggvvvvvvvvvgggvv..', 'vvvgggvvvvvvvvvgggvv..', 'vvvgggvvvvvvvvvgggvv..', 'vvvgggvvvvvvvvvgggvv..', 'vvvwwwvvvvvvvvvwwwvv..', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....', '...vvvvvvvvvvvvvvv....'], { v: '#6b3fb5', x: '#f0d060', g: '#8d6ac7' });

// ---------- 메타톤 EX 16x32 ----------
export const METTATON = def([
  '....kkkkkkkk....', '...kkkkkkkkkk...', '..kkkkkkkkkkkk..', '..kkkkkkkkkkkk..', '..kkkkssssssss..', '..kkkksmsssss...', '..kkkkssssssss..', '...kkksskkssss..', '....kkssssss....', '.....ssssss.....', '....mmmmmmmm....', '...mmmmmmmmmm...', '..mmkkkkkkkkmm..', '..mmkkkkkkkkmm..', '.mmmkkkkkkkkmmm.', '.mmmkkkkkkkkmmm.', '.mmmkkkkkkkkmmm.', '..m.kkkkkkkk.m..', '..m.kkkkkkkk.m..', '..m.kkkkkkkk.m..', '....mmmmmmmm....', '....mmmmmmmm....', '....mmm..mmm....', '....mmm..mmm....', '....mmm..mmm....', '....mmm..mmm....', '....mmm..mmm....', '....mmm..mmm....', '....mmm..mmm....', '...mmmm..mmmm...', '...kkkk..kkkk...', '...kkkk..kkkk...'], { m: '#ff5aa0' });
export const NEO = def(METTATON.rows.map((r, i) => (i >= 10 && i < 20) ? r.replace(/m/g, 'c').replace(/k/g, 'y') : r).map(r => r.replace(/^(.{2})/, 'cc')), { c: '#4ec8ff', y: '#ffd040' });

// ---------- 인형 12x20 ----------
export const DUMMY = def([
  '....aaaa....', '...aaaaaa...', '..aaaaaaaa..', '..aakaakaa..', '..aaaaaaaa..', '..aaaaaaaa..', '...aaaaaa...', '....aaaa....', '...aaaaaa...', '..aaaaaaaa..', '..aaaaaaaa..', '..aaaaaaaa..', '..aaaaaaaa..', '...aaaaaa...', '....aaaa....', '.....tt.....', '.....tt.....', '.....tt.....', '...tttttt...', '..tttttttt..'], { a: '#d6b8a8' });

// ---------- 전투용 몬스터 ----------
export const FROGGIT = def([
  '..wwww......wwww..', '.wwkkww....wwkkww.', '.wwkkww....wwkkww.', '..wwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwkkkkkkkkwwwww', 'wwwwwwwwwwwwwwwwww', '.wwwwwwwwwwwwwwww.', '..wwwwwwwwwwwwww..', '.wwww........wwww.', 'wwwww........wwwww', 'ww..............ww']);
export const WHIMSUN = def([
  'ww..............ww', 'www............www', 'wwww...wwww...wwww', 'wwwww.wwwwww.wwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwkwwwwkwwwwww', '.wwwwwwwwwwwwwwww.', '..wwwwwwkkwwwwww..', '...wwwwwwwwwwww...', '....wwwwwwwwww....', '....wwwwwwwwww....', '.....wwwwwwww.....', '......wwwwww......', '.......wwww.......']);
export const MOLDSMAL = def([
  '.....wwwwwwwww.....', '...wwwwwwwwwwwww...', '..wwwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwwww.', '.wwwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwwww', '.wwwwwwwwwwwwwwwww.', '..wwwwwwwwwwwwwww..']);
export const SNOWDRAKE = def([
  '......wwww........', '.....wwwwww.......', '....wwwwwwww......', '...wwwkwwwwww.....', '..wwwwwwwwwwww....', '.wwwwwwwwwwwwww...', 'wwwwwkkkkkkwwwww..', '.wwwwwwwwwwwwww...', '..wwwwwwwwwwwww...', '...wwwwwwwwwwwww..', '.wwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', '.wwwwwwwwwwwwwwww.', '..wwwwwwwwwwwwww..', '....wwww..wwww....', '....wwww..wwww....']);
export const ICECAP = def([
  '.......wwww.......', '......wwwwww......', '.....wwwwwwww.....', '....wwwwwwwwww....', '...wwwwwwwwwwww...', '..wwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwww', '..wwwwwwwwwwwwww..', '..wwwwkwwwwkwwww..', '..wwwwwwwwwwwwww..', '..wwwwwwkkwwwwww..', '...wwwwwwwwwwww...', '....wwwwwwwwww....', '.....wwwwwwww.....', '......wwwwww......']);
export const LESSERDOG = def([
  '..ww........ww....', '.wwww......wwww...', '.wwwwwwwwwwwwww...', '.wwwwwwwwwwwwww...', '.wwkkwwwwwwkkww...', '.wwwwwwwwwwwwww...', '.wwwwwwkkwwwwww...', '..wwwwwwwwwwww....', '...wwwwwwwwww.....', '....wwwwwwww......', '....wwwwwwww......', '..wwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwww..........wwww', 'wwww..........wwww']);
export const AARON = def([
  '....wwww..........', '...wwwwww.........', '..wwwwwwww........', '..wwkwwwww........', '..wwwwwwww........', '...wwwwww.........', '..wwwwwwwwww......', '.wwwwwwwwwwww.....', 'wwwwwwwwwwwwww....', 'wwwwwwwwwwwwww....', 'wwww.wwwwww.ww....', '.....wwwwwwwww....', '.....wwwwwwwwww...', '.....wwwwwwwwwww..', '......wwwwwwwwwww.', '.......wwwwwwwwwww', '........wwwwwwwwww', '..........wwwwwwww']);
export const WOSHUA = def([
  '.....wwwwwwww.....', '....wwwwwwwwww....', '...wwwwwwwwwwww...', '..wwwwwwwwwwwwww..', '..wwkkwwwwwwkkww..', '..wwwwwwwwwwwwww..', '..wwwwwwkkwwwwww..', '..wwwwwwwwwwwwww..', '.wwwwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', '.wwwwwwwwwwwwwwww.', '..wwww......wwww..', '..wwww......wwww..']);
export const VULKIN = def([
  '........ww........', '.......wwww.......', '......wwwwww......', '.....wwwwwwww.....', '....wwwwwwwwww....', '...wwwwwwwwwwww...', '..wwwkwwwwwwkwww..', '..wwwwwwwwwwwwww..', '.wwwwwwwkkwwwwwww.', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', '.wwwwwwwwwwwwwwww.', '..wwww......wwww..']);
export const TSUNDERPLANE = def([
  '.........ww.......', '........wwww......', 'ww.....wwwwww.....', 'www...wwwwwwww....', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwkwwwwkwwwwww', 'wwwwwwwwwwwwwwwwww', 'www...wwwkkwww....', 'ww.....wwwwww.....', '........wwww......', '.........ww.......']);
export const PYROPE = def([
  '.......wwww.......', '......wwwwww......', '.....wwwwwwww.....', '.....wkwwwwkw.....', '.....wwwwwwww.....', '......wwkkww......', '.......wwww.......', '.......wwww.......', '......wwwwww......', '......wwwwww......', '.......wwww.......', '.......wwww.......', '......wwwwww......', '.....wwwwwwww.....', '......wwwwww......', '.......wwww.......']);
// 아스리엘 24x44
export const ASRIEL = def([
  '..kk................kk..', '.kkk................kkk.', 'kkkk.....wwwwww.....kkkk', 'kkk....wwwwwwwwww....kkk', 'kk....wwwwwwwwwwww....kk', '......wwwwwwwwwwww......', '......wwkkwwwwkkww......', '......wwkkwwwwkkww......', '......wwwwwwwwwwww......', '.......wwwkkkkwww.......', '........wwwwwwww........', '........wwwwwwww........', '.....eeeeeeeeeeeeee.....', '....eeeeeeeeeeeeeeee....', '...eeeeeeexxxxeeeeeee...', '..eeeeeeeexxxxeeeeeeee..', '..eeeeeeeeexxeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..', '..eeeeeeeeeeeeeeeeeeee..'], { e: '#2a1a4e', x: '#e8e8ff' });

export const OVERWORLD = { flowey: FLOWEY, toriel: TORIEL, sans: SANS, papyrus: PAPYRUS, undyne: UNDYNE, kid: KID, rabbit: RABBIT, temmie: TEMMIE, blook: BLOOK, echo: ECHO, froggit: FROGGIT, vending: VENDING, asgore: ASGORE, mettaton: METTATON, dummy: DUMMY, chara: CHARA };
export const BATTLE = { dummy: DUMMY, froggit: FROGGIT, whimsun: WHIMSUN, moldsmal: MOLDSMAL, snowdrake: SNOWDRAKE, icecap: ICECAP, lesserdog: LESSERDOG, aaron: AARON, woshua: WOSHUA, temmie: TEMMIE, vulkin: VULKIN, tsunderplane: TSUNDERPLANE, pyrope: PYROPE,
  toriel: TORIEL, papyrus: PAPYRUS, undyne: UNDYNE, undying: UNDYING, mettaton: METTATON, neo: NEO, asgore: ASGORE, flowey: FLOWEY_EVIL, floweyIntro: FLOWEY, asriel: ASRIEL, sans: SANS };
export const BATTLE_SCALE = { dummy: 4, froggit: 4, whimsun: 4, moldsmal: 4, snowdrake: 4, icecap: 4, lesserdog: 4, aaron: 4, woshua: 4, temmie: 4, vulkin: 4, tsunderplane: 4, pyrope: 4, toriel: 4, papyrus: 4, undyne: 4, undying: 4, mettaton: 4, neo: 4, asgore: 4, flowey: 5, floweyIntro: 5, asriel: 3, sans: 5 };

// 스프라이트를 오프스크린 캔버스로 굽는다 (매 프레임 픽셀 단위로 그리지 않기 위해).
const cache = new Map();
export function bake(sprite, scale = 2, tint = null) {
  const key = `${sprite.rows.join('')}|${scale}|${tint}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(sprite.w * scale, sprite.h * scale) : Object.assign(document.createElement('canvas'), { width: sprite.w * scale, height: sprite.h * scale });
  const ctx = canvas.getContext('2d');
  sprite.rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = row[x]; if (c === '.') continue; ctx.fillStyle = tint || sprite.palette[c] || '#ff00ff'; ctx.fillRect(x * scale, y * scale, scale, scale); } });
  cache.set(key, canvas); return canvas;
}
