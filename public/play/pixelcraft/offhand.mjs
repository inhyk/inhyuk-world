import { I, ITEMS } from './data.mjs';
export function swapHands(player) {
  player.offhand??=[null];
  [player.inv[player.sel],player.offhand[0]]=[player.offhand[0],player.inv[player.sel]??null];
}
export function canUseOffhand(main,off) {
  if(!off)return false;
  const item=ITEMS[main?.id],other=ITEMS[off.id];
  if(item?.food||item?.place!==undefined||[I.BOW,I.BUCKET,I.WATER_BUCKET,I.LAVA_BUCKET,I.FLINT_STEEL,I.ENDER_EYE].includes(main?.id))return false;
  return !!other?.food||other?.place!==undefined;
}
