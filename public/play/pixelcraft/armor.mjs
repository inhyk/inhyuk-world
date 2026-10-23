import { protectDamage,wearAmount } from './enchantments.mjs';
import { ITEMS, durabilityOf } from './data.mjs';
export const ARMOR_SLOTS = ['투구', '흉갑', '바지', '신발'];
export function armorPoints(player) {
  return Math.min(20, (player.armor ?? []).reduce((sum, stack, slot) => sum + (stack && ITEMS[stack.id]?.armor?.slot === slot && (stack.dur ?? durabilityOf(stack.id)) > 0 ? ITEMS[stack.id].armor.points : 0), 0));
}
export function absorbDamage(player, amount, cause) {
  if (['fall', 'drown', 'starve', 'void'].includes(cause)) return protectDamage(player,amount,cause);
  const points = armorPoints(player);
  if (!points) return protectDamage(player,amount,cause);
  const damage = Math.max(0.5, amount * (1 - points * 0.04));
  const protectedDamage=protectDamage(player,damage,cause);
  for (let slot = 0; slot < 4; slot++) {
    const stack = player.armor?.[slot];
    if (!stack || ITEMS[stack.id]?.armor?.slot !== slot) continue;
    stack.dur = (stack.dur ?? durabilityOf(stack.id)) - wearAmount(stack,Math.max(1,Math.floor(amount/4)));
    if (stack.dur <= 0) player.armor[slot] = null;
  }
  return protectedDamage;
}
