// 이름이 두 가지다: 사이트(seonn.dev)는 「뿌요뿌요 타워」, 아이폰·안드로이드 앱은 「젤리 타워」.
// "뿌요뿌요"는 다른 회사(SEGA)의 게임 이름이라 앱 심사에서 거절될 수 있어서(앱스토어 5.2),
// 앱에 넣는 빌드(mode 'app')에서만 눈에 보이는 "뿌요"를 모두 "젤리"로 바꾼다 (방해 뿌요 → 방해 젤리, 뿌요 이모티콘 → 젤리 이모티콘).
// 코드와 화면 글은 "뿌요"로 적는다. 나중에 글을 더해도 앱에는 저절로 "젤리"로 나가고, 하나라도 남으면 앱 빌드가 멈춘다.
// 저장 키, 폴더, 서버 게임 이름(puyo-tower-v1, jelly-tower 같은 영어 이름)은 사이트와 앱이 같이 써서 바꾸지 않는다.
export const WEB_NAME = '뿌요뿌요 타워', APP_NAME = '젤리 타워';

// 긴 것부터 차례로 바꾼다
const RULES = [
  ['뿌요뿌요 타워', '젤리 타워'],
  ['PUYO PUYO TOWER', 'JELLY TOWER'],
  ['뿌요뿌요', '젤리'], // 로고 "뿌요뿌요<small>타워</small>"
  ['뿌요', '젤리'],
];
export function toAppBrand(text) {
  let out = String(text);
  for (const [from, to] of RULES) out = out.split(from).join(to);
  return out;
}

// 앱 빌드 결과에 남으면 안 되는 글자 (압축기가 뿌요 처럼 바꿔 적은 것도 찾는다)
const LEFT = /뿌요|\\ubfcc\\uc694|PUYO PUYO/i;
export const hasWebBrand = text => LEFT.test(String(text));

// Vite 플러그인: 앱 빌드에서만 쓴다 (vite.config.js)
export function appBrandPlugin() {
  return {
    name: 'jelly-tower-app-brand',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0];
      if (file.includes('/node_modules/') || !/\.(mjs|js|css)$/.test(file)) return null;
      const out = toAppBrand(code);
      return out === code ? null : { code: out, map: null };
    },
    transformIndexHtml: { order: 'pre', handler: html => toAppBrand(html) },
    generateBundle(_options, bundle) {
      for (const [name, item] of Object.entries(bundle)) {
        if (!/\.(m?js|css|html|json)$/.test(name)) continue; // 그림, 글꼴은 보지 않는다
        // 워커처럼 따로 묶인 파일은 글자가 아니라 바이트로 들어온다
        const text = item.type === 'chunk' ? item.code : typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source);
        if (hasWebBrand(text)) this.error(`앱 빌드에 "뿌요"가 남아 있어요: ${name} (games/puyo-puyo/brand.mjs)`);
      }
    },
  };
}
