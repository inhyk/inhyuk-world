import { MISSIONS, DAILY_POOL, ensureDaily, track } from './missions.mjs';
import { SKINS, EFFECTS, grant } from './shop.mjs';
import { TOP_FLOOR, clearFloor } from './tower.mjs';
import { resetPassword } from './profile.mjs';

// 이 기기에서 즐기는 제작자 도구. 잠금 해제는 저장하지 않고 로그인 세션에서만 유지한다.
export function createCreatorSession() {
  let unlocked = false;
  return {
    get unlocked() { return unlocked; },
    unlock(password) { unlocked = password === '7777777'; return unlocked; },
    lock() { unlocked = false; },
    // 이 기기 계정의 비밀번호를 잊었을 때 새로 정한다 (제작자 모드가 열려 있을 때만)
    async resetPassword(store, id, password) {
      if (!unlocked) return { ok: false, error: '제작자 모드를 먼저 열어 줘.' };
      return resetPassword(store, id, password);
    },
    apply(progress, action) {
      if (!unlocked) return null;
      if (action === 'tower') {
        for (let floor = 1; floor <= TOP_FLOOR; floor++) clearFloor(progress.tower, floor);
        grant(progress, 'skin', 'crown');
        track(progress, { type: 'tower', floor: TOP_FLOOR });
        return '👑 왕관 층까지 타워 클리어! 비밀의 혜성 층이 열렸어.';
      }
      if (action === 'level') {
        if (progress.level < 50) { progress.level = 50; progress.xp = 0; }
        track(progress, { type: 'level', level: progress.level });
        return `🌟 레벨 ${progress.level}!`;
      }
      if (action === 'missions') {
        for (const def of MISSIONS) {
          const slot = progress.missions[def.id] ||= { v: 0, claimed: false };
          slot.v = Math.max(slot.v, def.goal);
        }
        for (const slot of ensureDaily(progress).list) slot.v = DAILY_POOL.find(d => d.id === slot.id).goal;
        return '🎯 모든 챌린지와 오늘의 미션 완료! 챌린지에서 보상을 받아 줘.';
      }
      if (action === 'skins') {
        for (const item of SKINS) grant(progress, 'skin', item.id);
        for (const item of EFFECTS) grant(progress, 'effect', item.id);
        return '🎨 모든 스킨과 터짐 효과 해제! 상점에서 장착할 수 있어.';
      }
      return null;
    },
  };
}
