'use strict';
// Map maker: the CREATE button on the title screen opens this. Maps are saved
// in this browser and played in the engine's extra level slot (15).
(() => {
  const COLUMNS = 400;
  // The designer asked for no height limit: maps go up to 40 rows, and the
  // view shows 11 of them at a time (scroll with ▲ ▼).
  const MAX_ROWS = 40;
  const ROWS = 11;
  const VIEW_ROWS = 12; // rows plus a strip of floor
  const STORAGE_KEY = 'dash-classic:editor';
  const CUSTOM_LEVEL = window.CLASSIC_LEVEL_LIST.length; // the map maker slot after levels 1-100
  const CODE_PREFIX = 'DOC1.';
  const TOOLS = [
    {id: 1, name: '블록'},
    {id: 40, name: '반 블록'},
    {id: 202, name: '검은 블록'},
    {id: 203, name: '검은 반 블록'},
    {id: 8, name: '가시'},
    {id: 39, name: '작은 가시'},
    {id: 35, name: '점프 패드'},
    {id: 222, name: '분홍 패드'},
    {id: 223, name: '파랑 패드'},
    {id: 36, name: '점프 링'},
    {id: 220, name: '분홍 링'},
    {id: 221, name: '파랑 링'},
    {id: 13, name: '비행선 포털'},
    {id: 12, name: '큐브 포털'},
    {id: 210, name: '공 포털'},
    {id: 211, name: 'UFO 포털'},
    {id: 212, name: '웨이브 포털'},
    {id: 11, name: '중력 뒤집기'},
    {id: 10, name: '중력 되돌리기'},
    {id: 213, name: '느린 속도'},
    {id: 214, name: '보통 속도'},
    {id: 215, name: '빠른 속도'},
    {id: 216, name: '아주 빠른 속도'},
    {id: 201, name: '코인'},
    {id: 0, name: '지우개'},
  ];
  const SONGS = ['Neon Start', 'Pixel Hop', 'Blue Ladder', 'Desert Wind', 'Iron Gate', 'Night Rail', 'Sky Rocket',
    'Crystal Cave', 'Thunder Road', 'Lava Lift', 'Star Factory', 'Frost Bite', 'Laser Maze', 'Black Hole', 'Overdrive',
    'Golden Key', 'Secret Core', 'Last Dash', 'Volt Rush', 'Endless Dash', 'DASH AND RUN'];
  const PALETTES = [
    {name: '파랑', bg: [40, 125, 255], ground: [0, 86, 230]},
    {name: '초록', bg: [40, 200, 120], ground: [0, 140, 90]},
    {name: '분홍', bg: [255, 92, 200], ground: [170, 40, 140]},
    {name: '주황', bg: [255, 150, 40], ground: [200, 82, 0]},
    {name: '보라', bg: [130, 70, 230], ground: [70, 30, 160]},
    {name: '밤하늘', bg: [56, 40, 140], ground: [26, 14, 84]},
  ];

  const panel = document.getElementById('editor');
  const canvas = document.getElementById('editor-canvas');
  const context = canvas.getContext('2d');
  const tools = document.getElementById('editor-tools');
  const songSelect = document.getElementById('editor-song');
  const colorSelect = document.getElementById('editor-colors');
  const savedLabel = document.getElementById('editor-saved');
  const position = document.getElementById('editor-position');
  const confirmBox = document.getElementById('editor-confirm');

  let map = load();
  let tool = 1;
  let scroll = -2; // first visible column; -2 shows the start
  let rowScroll = 0; // lowest visible row
  let painting = null;
  let hover = null;
  let testing = false;
  const sprites = new Map();

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data && Array.isArray(data.cells)) {
        return {cells: new Map(data.cells.map(([c, r, id]) => [`${c},${r}`, id])), song: data.song | 0, colors: data.colors | 0};
      }
    } catch {
      // a broken save starts a new map
    }
    return {cells: new Map(), song: 0, colors: 0};
  }

  function save() {
    const cells = [...map.cells].map(([key, id]) => [...key.split(',').map(Number), id]);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({cells, song: map.song, colors: map.colors}));
      savedLabel.textContent = '저장됨';
    } catch {
      savedLabel.textContent = '저장 못 함';
    }
  }

  // ---- level text for the engine (GD units: a tile is 30) ----------------
  const gx = c => 30 * c + 15;
  const yFor = {
    1: r => 30 * r + 15,
    40: r => 23.25 + 30 * r,
    202: r => 30 * r + 15,
    203: r => 23.25 + 30 * r,
    8: r => 30 * r + 15,
    39: r => 6.75 + 30 * r,
    35: r => 2 + 30 * r,
    222: r => 2 + 30 * r,
    223: r => 2 + 30 * r,
    36: r => 30 * r + 15,
    220: r => 30 * r + 15,
    221: r => 30 * r + 15,
    13: r => 42 + 30 * r,
    12: r => 42 + 30 * r,
    210: r => 42 + 30 * r,
    211: r => 42 + 30 * r,
    212: r => 42 + 30 * r,
    11: r => 36.5 + 30 * r,
    10: r => 36.5 + 30 * r,
    // speed gates stand on the cell's floor
    213: r => 18.75 + 30 * r,
    214: r => 18.75 + 30 * r,
    215: r => 18.75 + 30 * r,
    216: r => 18.75 + 30 * r,
    201: r => 30 * r + 15,
  };

  function levelText(source = map) {
    const palette = PALETTES[source.colors] || PALETTES[0];
    const color = ([r, g, b]) => `1_${r}_2_${g}_3_${b}`;
    const header = `kS29,${color(palette.bg)},kS30,${color(palette.ground)}`;
    const objects = [];
    let last = 0;
    for (const [key, id] of source.cells) {
      const [c, r] = key.split(',').map(Number);
      if (!yFor[id]) continue;
      objects.push(`1,${id},2,${gx(c)},3,${yFor[id](r)}`);
      last = Math.max(last, c);
    }
    // a little room after the last object, and never shorter than 30 tiles
    const end = Math.max(30, last + 10);
    objects.push(`1,29,2,${30 * end},3,0,7,${palette.bg[0]},8,${palette.bg[1]},9,${palette.bg[2]},10,0.5`);
    return `${header};${objects.join(';')};`;
  }

  // ---- sharing: a map code anyone can paste into their own map maker ------
  const ALLOWED = new Set(TOOLS.map(tool => tool.id).filter(Boolean));
  function fromData(data) {
    const cells = new Map();
    if (data && Array.isArray(data.cells)) {
      for (const cell of data.cells.slice(0, 6000)) {
        if (!Array.isArray(cell) || cell.length !== 3) continue;
        const [c, r, id] = cell.map(Number);
        if (Number.isInteger(c) && Number.isInteger(r) && c >= 0 && c < COLUMNS && r >= 0 && r < MAX_ROWS && ALLOWED.has(id)) cells.set(`${c},${r}`, id);
      }
    }
    const song = Number.isInteger(data?.song) && data.song >= 0 && data.song < SONGS.length ? data.song : 0;
    const colors = Number.isInteger(data?.colors) && data.colors >= 0 && data.colors < PALETTES.length ? data.colors : 0;
    return {cells, song, colors};
  }
  const toBase64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromBase64 = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
  async function squeeze(bytes, mode) {
    const stream = new Blob([bytes]).stream().pipeThrough(mode === 'in' ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function exportCode() {
    const data = {cells: [...map.cells].map(([key, id]) => [...key.split(',').map(Number), id]), song: map.song, colors: map.colors};
    const json = new TextEncoder().encode(JSON.stringify(data));
    return CODE_PREFIX + toBase64(await squeeze(json, 'in'));
  }
  async function importCode(text) {
    const code = String(text).trim().replace(/\s+/g, '');
    if (!code.startsWith(CODE_PREFIX)) throw Error('맵 코드가 아니야');
    const json = new TextDecoder().decode(await squeeze(fromBase64(code.slice(CODE_PREFIX.length)), 'out'));
    return fromData(JSON.parse(json));
  }
  const shareBox = document.getElementById('editor-share');
  const shareText = document.getElementById('editor-share-text');
  const shareNote = document.getElementById('editor-share-note');
  for (const type of ['keydown', 'keyup', 'keypress']) shareText.addEventListener(type, event => event.stopPropagation());
  document.getElementById('editor-copy').addEventListener('click', async () => {
    shareBox.hidden = false;
    shareBox.dataset.mode = 'copy';
    shareText.value = await exportCode();
    shareText.readOnly = true;
    shareText.select();
    document.getElementById('editor-share-load').hidden = true;
    try {
      await navigator.clipboard.writeText(shareText.value);
      shareNote.textContent = '복사했어! 친구에게 이 코드를 보내 주면 친구가 "코드로 불러오기"로 내 맵을 할 수 있어.';
    } catch {
      shareNote.textContent = '이 코드를 꾹 눌러 복사해서 친구에게 보내 줘.';
    }
  });
  document.getElementById('editor-paste').addEventListener('click', () => {
    shareBox.hidden = false;
    shareText.value = '';
    shareText.readOnly = false;
    document.getElementById('editor-share-load').hidden = false;
    shareNote.textContent = '친구가 보낸 맵 코드를 붙여 넣어 줘. 지금 맵은 그 맵으로 바뀌어.';
    shareText.focus();
  });
  document.getElementById('editor-share-load').addEventListener('click', async () => {
    try {
      const loaded = await importCode(shareText.value);
      map = loaded;
      save();
      songSelect.value = String(map.song);
      colorSelect.value = String(map.colors);
      shareBox.hidden = true;
      draw();
    } catch {
      shareNote.textContent = '코드를 읽지 못했어. 처음부터 끝까지 다 붙여 넣었는지 봐 줘.';
    }
  });
  document.getElementById('editor-share-close').addEventListener('click', () => {
    shareBox.hidden = true;
  });

  function test() {
    if (!window.FS || !window.classicStartLevel) return;
    save();
    FS.writeFile(`/res/leveldata/${CUSTOM_LEVEL}.level`, levelText());
    Module._classic_set_custom_song(map.song);
    testing = true;
    close();
    window.classicStartLevel(CUSTOM_LEVEL);
  }

  // ---- drawing ----------------------------------------------------------
  function loadSprites() {
    if (sprites.size || !window.FS) return;
    for (const {id} of TOOLS) {
      if (!id) continue;
      try {
        const bytes = FS.readFile(`/res/gfx/objects/${id}.png`);
        const image = new Image();
        image.src = URL.createObjectURL(new Blob([bytes], {type: 'image/png'}));
        image.onload = draw;
        sprites.set(id, image);
      } catch {
        // drawn as a plain box instead
      }
    }
    try {
      const skin = Number(localStorage.getItem('dash-classic:1')) || 0;
      const bytes = FS.readFile(`/res/gfx/skins/${skin}.png`);
      const image = new Image();
      image.src = URL.createObjectURL(new Blob([bytes], {type: 'image/png'}));
      image.onload = draw;
      sprites.set('player', image);
    } catch {
      // no skin, the start is just a line
    }
  }

  function cellSize() {
    return canvas.height / VIEW_ROWS;
  }

  function visibleColumns() {
    return Math.ceil(canvas.width / cellSize());
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(box.width * ratio));
    canvas.height = Math.max(1, Math.round(box.height * ratio));
    draw();
  }

  function rect(id, c, r) {
    const size = cellSize();
    const x = (c - scroll) * size;
    const bottom = (ROWS - (r - rowScroll)) * size;
    switch (id) {
      case 40: case 203: return [x, bottom - size, size, size * 0.45];
      case 39: return [x, bottom - size * 0.45, size, size * 0.45];
      case 35: case 222: case 223: return [x + size * 0.08, bottom - size * 0.14, size * 0.84, size * 0.14];
      case 13: case 12: case 210: case 211: case 212: return [x - size * 0.05, bottom - size * 2.8, size * 1.1, size * 2.8];
      case 213: case 214: case 215: case 216: return [x + size * 0.04, bottom - size * 1.25, size * 0.92, size * 1.25];
      case 11: case 10: return [x + size * 0.1, bottom - size * 2.43, size * 0.8, size * 2.43];
      default: return [x, bottom - size, size, size];
    }
  }

  function draw() {
    if (panel.hidden) return;
    const size = cellSize();
    const palette = PALETTES[map.colors] || PALETTES[0];
    const {width, height} = canvas;
    context.fillStyle = `rgb(${palette.bg.join(',')})`;
    context.fillRect(0, 0, width, height);
    if (rowScroll === 0) {
      context.fillStyle = `rgb(${palette.ground.join(',')})`;
      context.fillRect(0, ROWS * size, width, height - ROWS * size);
      context.fillStyle = '#ffffff';
      context.fillRect(0, ROWS * size - 2, width, 4);
    } else {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(0, ROWS * size, width, height - ROWS * size);
    }
    // row numbers on the left
    context.fillStyle = 'rgba(255,255,255,0.7)';
    context.font = `${Math.round(size * 0.26)}px sans-serif`;
    for (let r = rowScroll; r < rowScroll + ROWS; r++) {
      if (r % 5 === 0) context.fillText(`↑${r}`, 4, (ROWS - (r - rowScroll)) * size - 4);
    }
    context.strokeStyle = 'rgba(255,255,255,0.14)';
    context.lineWidth = 1;
    for (let c = Math.floor(scroll); c <= scroll + visibleColumns(); c++) {
      const x = Math.round((c - scroll) * size) + 0.5;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, ROWS * size);
      context.stroke();
      if (c >= 0 && c % 10 === 0) {
        context.fillStyle = 'rgba(255,255,255,0.65)';
        context.font = `${Math.round(size * 0.28)}px sans-serif`;
        context.fillText(String(c), x + 4, ROWS * size + size * 0.4);
      }
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = Math.round(r * size) + 0.5;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    // the start: the cube begins one tile before column 0
    const startX = (-1 - scroll) * size;
    const player = sprites.get('player');
    if (player?.complete && rowScroll === 0) context.drawImage(player, startX, (ROWS - 1) * size, size, size);
    context.fillStyle = '#7cff4c';
    context.fillRect((0 - scroll) * size - 2, 0, 4, ROWS * size);

    for (const [key, id] of map.cells) {
      const [c, r] = key.split(',').map(Number);
      if (c < scroll - 2 || c > scroll + visibleColumns() + 1 || r < rowScroll - 3 || r > rowScroll + ROWS) continue;
      const [x, y, w, h] = rect(id, c, r);
      const sprite = sprites.get(id);
      if (sprite?.complete && sprite.naturalWidth) {
        context.save();
        context.translate(x, y);
        context.drawImage(sprite, 0, 0, w, h);
        context.restore();
      } else {
        context.fillStyle = id === 8 || id === 39 ? '#ff3d7f' : '#4f63ff';
        context.fillRect(x, y, w, h);
      }
    }
    if (hover) {
      const [c, r] = hover;
      context.strokeStyle = tool ? '#bfff59' : '#ff5a7a';
      context.lineWidth = 3;
      context.strokeRect((c - scroll) * size + 2, (ROWS - 1 - (r - rowScroll)) * size + 2, size - 4, size - 4);
    }
  }

  // ---- input ------------------------------------------------------------
  function cellAt(event) {
    const box = canvas.getBoundingClientRect();
    const ratio = canvas.width / box.width;
    const size = cellSize();
    const c = Math.floor((event.clientX - box.left) * ratio / size + scroll);
    const r = rowScroll + ROWS - 1 - Math.floor((event.clientY - box.top) * ratio / size);
    if (c < 0 || c >= COLUMNS || r < 0 || r >= MAX_ROWS) return null;
    return [c, r];
  }

  function apply(cell) {
    if (!cell || !painting) return;
    const key = cell.join(',');
    if (painting === 'erase') map.cells.delete(key);
    else map.cells.set(key, tool);
    savedLabel.textContent = '저장 중…';
    draw();
  }

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    const cell = cellAt(event);
    if (!cell) return;
    canvas.setPointerCapture(event.pointerId);
    const current = map.cells.get(cell.join(','));
    painting = !tool || current === tool ? 'erase' : 'place';
    apply(cell);
  });
  canvas.addEventListener('pointermove', event => {
    hover = cellAt(event);
    if (painting) apply(hover);
    else draw();
  });
  function stopPainting() {
    if (!painting) return;
    painting = null;
    save();
  }
  canvas.addEventListener('pointerup', stopPainting);
  canvas.addEventListener('pointercancel', stopPainting);
  canvas.addEventListener('pointerleave', () => {
    hover = null;
    draw();
  });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    if (event.shiftKey) {
      scrollRows(rowScroll + (event.deltaY > 0 ? -1 : 1));
      return;
    }
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    scrollTo(scroll + delta / 40);
  }, {passive: false});

  function scrollRows(row) {
    rowScroll = Math.max(0, Math.min(MAX_ROWS - ROWS, row));
    document.getElementById('editor-height').textContent = rowScroll ? `높이 ${rowScroll}~${rowScroll + ROWS - 1}` : '바닥';
    draw();
  }
  document.getElementById('editor-up').addEventListener('click', () => scrollRows(rowScroll + 4));
  document.getElementById('editor-down').addEventListener('click', () => scrollRows(rowScroll - 4));

  function scrollTo(column) {
    scroll = Math.max(-2, Math.min(COLUMNS - visibleColumns() + 2, column));
    position.value = String(Math.round(scroll));
    draw();
  }
  document.getElementById('editor-left').addEventListener('click', () => scrollTo(Math.round(scroll) - 8));
  document.getElementById('editor-right').addEventListener('click', () => scrollTo(Math.round(scroll) + 8));
  position.addEventListener('input', () => scrollTo(Number(position.value)));

  function buildTools() {
    tools.textContent = '';
    for (const item of TOOLS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'editor-tool';
      button.setAttribute('aria-pressed', String(item.id === tool));
      const sprite = sprites.get(item.id);
      if (sprite) {
        const image = document.createElement('img');
        image.src = sprite.src;
        image.alt = '';
        button.append(image);
      } else {
        const icon = document.createElement('span');
        icon.className = 'eraser';
        icon.textContent = '⌫';
        button.append(icon);
      }
      const label = document.createElement('span');
      label.textContent = item.name;
      button.append(label);
      button.addEventListener('click', () => {
        tool = item.id;
        for (const other of tools.children) other.setAttribute('aria-pressed', String(other === button));
      });
      tools.append(button);
    }
  }

  SONGS.forEach((name, index) => songSelect.add(new Option(`${index + 1}. ${name}`, String(index))));
  PALETTES.forEach((palette, index) => colorSelect.add(new Option(palette.name, String(index))));
  songSelect.addEventListener('change', () => {
    map.song = Number(songSelect.value);
    save();
  });
  colorSelect.addEventListener('change', () => {
    map.colors = Number(colorSelect.value);
    save();
    draw();
  });
  document.getElementById('editor-test').addEventListener('click', test);
  document.getElementById('editor-close').addEventListener('click', () => close());
  document.getElementById('editor-clear').addEventListener('click', () => {
    confirmBox.hidden = false;
  });
  document.getElementById('editor-confirm-no').addEventListener('click', () => {
    confirmBox.hidden = true;
  });
  document.getElementById('editor-confirm-yes').addEventListener('click', () => {
    map.cells.clear();
    confirmBox.hidden = true;
    save();
    draw();
  });

  function open() {
    if (!window.FS) return;
    loadSprites();
    buildTools();
    songSelect.value = String(map.song);
    colorSelect.value = String(map.colors);
    panel.hidden = false;
    confirmBox.hidden = true;
    requestAnimationFrame(resize);
  }

  function close() {
    panel.hidden = true;
    painting = null;
    hover = null;
  }

  window.addEventListener('resize', () => {
    if (!panel.hidden) resize();
  });

  window.classicEditor = {
    open,
    close,
    isOpen: () => !panel.hidden,
    reopenAfterTest() {
      if (!testing) return;
      testing = false;
      open();
    },
    handleKey(event) {
      if (event.type !== 'keydown') return;
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowLeft') scrollTo(Math.round(scroll) - 4);
      else if (event.key === 'ArrowRight') scrollTo(Math.round(scroll) + 4);
      else if (event.key === 'ArrowUp') scrollRows(rowScroll + 1);
      else if (event.key === 'ArrowDown') scrollRows(rowScroll - 1);
    },
    levelText,
    // for the online race: the saved map, and turning a received one into a level
    map: () => ({cells: [...map.cells].map(([key, id]) => [...key.split(',').map(Number), id]), song: map.song, colors: map.colors}),
    levelTextFor: data => levelText(fromData(data)),
  };
})();
