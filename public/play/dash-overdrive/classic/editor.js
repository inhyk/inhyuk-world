'use strict';
// Map maker: the CREATE button on the title screen opens this. Maps are saved
// in this browser and played in the engine's extra level slot (15).
(() => {
  const COLUMNS = 400;
  const ROWS = 11;
  const VIEW_ROWS = 12; // rows plus a strip of floor
  const STORAGE_KEY = 'dash-classic:editor';
  const CUSTOM_LEVEL = 18;
  const TOOLS = [
    {id: 1, name: '블록'},
    {id: 40, name: '반 블록'},
    {id: 8, name: '가시'},
    {id: 39, name: '작은 가시'},
    {id: 35, name: '점프 패드'},
    {id: 36, name: '점프 링'},
    {id: 13, name: '비행선 포털'},
    {id: 12, name: '큐브 포털'},
    {id: 11, name: '중력 뒤집기'},
    {id: 10, name: '중력 되돌리기'},
    {id: 201, name: '코인'},
    {id: 0, name: '지우개'},
  ];
  const SONGS = ['Neon Start', 'Pixel Hop', 'Blue Ladder', 'Desert Wind', 'Iron Gate', 'Night Rail', 'Sky Rocket',
    'Crystal Cave', 'Thunder Road', 'Lava Lift', 'Star Factory', 'Frost Bite', 'Laser Maze', 'Black Hole', 'Overdrive',
    'Golden Key', 'Secret Core', 'Last Dash'];
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
    8: r => 30 * r + 15,
    39: r => 6.75 + 30 * r,
    35: r => 2 + 30 * r,
    36: r => 30 * r + 15,
    13: r => 42 + 30 * r,
    12: r => 42 + 30 * r,
    11: r => 36.5 + 30 * r,
    10: r => 36.5 + 30 * r,
    201: r => 30 * r + 15,
  };

  function levelText() {
    const palette = PALETTES[map.colors] || PALETTES[0];
    const color = ([r, g, b]) => `1_${r}_2_${g}_3_${b}`;
    const header = `kS29,${color(palette.bg)},kS30,${color(palette.ground)}`;
    const objects = [];
    let last = 0;
    for (const [key, id] of map.cells) {
      const [c, r] = key.split(',').map(Number);
      objects.push(`1,${id},2,${gx(c)},3,${yFor[id](r)}`);
      last = Math.max(last, c);
    }
    // a little room after the last object, and never shorter than 30 tiles
    const end = Math.max(30, last + 10);
    objects.push(`1,29,2,${30 * end},3,0,7,${palette.bg[0]},8,${palette.bg[1]},9,${palette.bg[2]},10,0.5`);
    return `${header};${objects.join(';')};`;
  }

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
    const bottom = (ROWS - r) * size;
    switch (id) {
      case 40: return [x, bottom - size, size, size * 0.45];
      case 39: return [x, bottom - size * 0.45, size, size * 0.45];
      case 35: return [x + size * 0.08, bottom - size * 0.14, size * 0.84, size * 0.14];
      case 13: case 12: return [x - size * 0.05, bottom - size * 2.8, size * 1.1, size * 2.8];
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
    context.fillStyle = `rgb(${palette.ground.join(',')})`;
    context.fillRect(0, ROWS * size, width, height - ROWS * size);
    context.fillStyle = '#ffffff';
    context.fillRect(0, ROWS * size - 2, width, 4);
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
    if (player?.complete) context.drawImage(player, startX, (ROWS - 1) * size, size, size);
    context.fillStyle = '#7cff4c';
    context.fillRect((0 - scroll) * size - 2, 0, 4, ROWS * size);

    for (const [key, id] of map.cells) {
      const [c, r] = key.split(',').map(Number);
      if (c < scroll - 2 || c > scroll + visibleColumns() + 1) continue;
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
      context.strokeRect((c - scroll) * size + 2, (ROWS - 1 - r) * size + 2, size - 4, size - 4);
    }
  }

  // ---- input ------------------------------------------------------------
  function cellAt(event) {
    const box = canvas.getBoundingClientRect();
    const ratio = canvas.width / box.width;
    const size = cellSize();
    const c = Math.floor((event.clientX - box.left) * ratio / size + scroll);
    const r = ROWS - 1 - Math.floor((event.clientY - box.top) * ratio / size);
    if (c < 0 || c >= COLUMNS || r < 0 || r >= ROWS) return null;
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
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    scrollTo(scroll + delta / 40);
  }, {passive: false});

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
    },
    levelText,
  };
})();
