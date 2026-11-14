const shapes={
 p:'<circle cx="40" cy="22" r="10"/><path d="M33 32h14l-3 10 9 17H27l9-17z"/>',
 r:'<path d="M23 14h9v10h5V14h7v10h5V14h9v19l-9 6 3 20H28l3-20-8-6z"/>',
 n:'<path d="M26 59l3-14 16-12-12 3-12-7 9-13 10-2 6-8 5 12c16 9 15 25 7 41z"/><path d="M28 26l6 2" fill="none"/><circle cx="43" cy="23" r="2" fill="currentColor" stroke="none"/>',
 b:'<path d="M40 9c-22 17-16 27-6 32l-7 18h26l-7-18c10-5 16-15-6-32z"/><path d="M44 18l-9 12" fill="none"/>',
 q:'<path d="M24 28l8 10 8-16 8 16 9-10-6 31H29z"/><circle cx="22" cy="23" r="5"/><circle cx="40" cy="16" r="5"/><circle cx="59" cy="23" r="5"/>',
 k:'<path d="M35 9h10v7h7v9H28v-9h7zM32 58l-7-21c-4-12 10-15 15-4 5-11 19-8 15 4l-7 21z"/>'
};
export function pieceSVG(type,color) {
 const fill=color==='w'?'#fff9eb':'#383b3b',stroke=color==='w'?'#45483e':'#141b18';
 return `<svg viewBox="0 0 80 80" aria-hidden="true" class="piece" style="color:${stroke}"><g fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">${shapes[type]}<path d="M26 59h28l4 9H22z"/><path d="M29 63h22" fill="none" opacity=".35"/></g></svg>`;
}
