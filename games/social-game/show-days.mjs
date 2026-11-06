// Fountain show days (the plaza site builds the show itself; this only says when it is on).
// Pure (no three.js, no DOM) so core.mjs and its tests can use it.

/** The fountain show is at 7 p.m. (19:00). */
export const SHOW_HOUR = 19;

/** Is there a fountain show on day n (1-based, day 1 is a Monday)? Fridays (weekday index 4). */
export function isShowDay(day) {
  return (day - 1) % 7 === 4;
}
