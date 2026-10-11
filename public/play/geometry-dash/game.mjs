import { LEVELS, RECORD_KEY, SIZE, createGame, jump, releaseJump, tick, retry } from './core.mjs';
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
let g = createGame(), held = false, accumulator = 0, last = 0, audio, sound = false, beat = -1, particles = [], best = [0,0,0], practiceBest = [0,0,0];
try { best = JSON.parse(localStorage.getItem(RECORD_KEY) || '[0,0,0]').map(v => Number(v) || 0); } catch {}
let W = 1100, H = 460, ground = 350;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize() {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  W = Math.max(650, rect.width); H = rect.height / rect.width * W; ground = H * .77;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}
new ResizeObserver(resize).observe(canvas);
function progress() { return Math.min(100, Math.floor(g.x / LEVELS[g.level].length * 100)); }
function record() {
  const target = g.practice ? practiceBest : best;
  target[g.level] = Math.max(target[g.level] || 0, progress());
  if (!g.practice) try { localStorage.setItem(RECORD_KEY, JSON.stringify(best)); } catch {}
}
function refresh() {
  const level = LEVELS[g.level];
  document.documentElement.style.setProperty('--accent', level.color);
  $('level-name').textContent = level.name;
  $('practice-tag').textContent = g.practice ? 'PRACTICE · 체크포인트' : '';
  $('attempt').textContent = `ATTEMPT ${String(g.attempts).padStart(2,'0')}`;
  $('best').textContent = `BEST ${best[g.level] || 0}%`;
  $('percent').textContent = `${progress()}%`;
  $('progress').style.width = `${progress()}%`;
  $('status').textContent = {ready:'READY TO RUN',playing:g.practice?'PRACTICE MODE':'FEEL THE RHYTHM',dead:'TRY AGAIN. GO FURTHER.',paused:'TAKE A BREATH',won:'TRACK COMPLETE'}[g.mode];
  document.querySelectorAll('.track').forEach((el,i) => {
    el.classList.toggle('selected', i === g.level); el.setAttribute('aria-pressed', String(i === g.level));
    el.querySelector('.track-best').textContent = `${best[i] || 0}%`;
  });
  $('pause').disabled = !['playing','paused'].includes(g.mode);
  $('practice').disabled = g.mode === 'playing' || g.mode === 'paused';
}
function overlay() {
  $('overlay').hidden = g.mode === 'playing';
  $('badge').textContent = `${LEVELS[g.level].difficulty} / ${LEVELS[g.level].name}`;
  const states = {
    ready: ['준비됐어?', '천장 가시 등장! 짧게 눌러 낮게, 길게 눌러 높게.', '플레이'],
    dead: [`${progress()}% · 한 번 더!`, g.practice && g.checkpoint ? '저장된 체크포인트에서 다시 출발해.' : `시도 ${g.attempts}회 · 타이밍을 잡고 다시 도전해.`, '재도전'],
    paused: ['잠깐 쉬어가기', '준비가 되면 다시 리듬을 타자.', '계속하기'],
    won: ['LEVEL COMPLETE!', g.practice ? '연습 완료! 이제 일반 모드에 도전해 봐.' : `${g.attempts}번의 도전 끝에 완주했어!`, g.level < 2 ? '다음 스테이지' : '다시 플레이'],
  };
  if (states[g.mode]) {
    const [title,message,label] = states[g.mode];
    $('title').textContent = title; $('message').textContent = message;
    $('start').innerHTML = `${label} <span>▶</span>`;
    $('overlay-hint').textContent = g.mode === 'paused' ? 'P / ESC로 계속하기' : '짧게 눌러 낮게 · 길게 눌러 높게';
  }
  refresh();
}
function initAudio() {
  if (!audio) try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  if (audio?.state === 'suspended') audio.resume().catch(() => {});
}
function tone(freq, duration, type = 'sine', volume = .04) {
  if (!sound || !audio || audio.state !== 'running') return;
  const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime;
  osc.type = type; osc.frequency.setValueAtTime(freq,t);
  gain.gain.setValueAtTime(volume,t); gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t+duration);
}
function select(index) {
  held = false; g = createGame(index, $('practice').checked); particles = []; beat = -1; overlay();
}
function action() {
  initAudio();
  if (g.mode === 'paused') { g.mode = 'playing'; overlay(); }
  else if (g.mode === 'won') { select((g.level+1)%3); g.mode = 'playing'; overlay(); }
  else if (g.mode === 'dead') { retry(g); particles = []; beat = -1; overlay(); }
  else if (g.mode === 'ready') { g.mode = 'playing'; overlay(); }
  else if (jump(g)) tone(600,.1,'triangle');
}
function pause() {
  held = false;
  if (g.mode === 'playing') { g.mode = 'paused'; overlay(); }
  else if (g.mode === 'paused') { g.mode = 'playing'; overlay(); }
}
$('start').addEventListener('click', action);
$('pause').addEventListener('click', pause);
$('practice').addEventListener('change', () => select(g.level));
document.querySelectorAll('.track').forEach(el => el.addEventListener('click', () => select(Number(el.dataset.level))));
$('sound').addEventListener('click', () => { sound = !sound; initAudio(); $('sound').textContent = sound ? '♪ 소리 ON' : '♪ 소리 OFF'; $('sound').setAttribute('aria-pressed',String(sound)); $('sound').setAttribute('aria-label',sound ? '소리 끄기' : '소리 켜기'); tone(440,.15); });
$('fullscreen').addEventListener('click', async () => { try { if(document.fullscreenElement) await document.exitFullscreen(); else await $('stage').requestFullscreen(); } catch {} });
canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.focus(); held = true; canvas.setPointerCapture(e.pointerId); action(); });
function release() { if(held) releaseJump(g); held = false; }
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
window.addEventListener('keydown', e => {
  if (['INPUT','BUTTON','A'].includes(document.activeElement?.tagName) && ['Space','Enter'].includes(e.code)) return;
  if (['Space','ArrowUp','KeyW'].includes(e.code)) { e.preventDefault(); if (!e.repeat) { action(); held = g.mode === 'playing'; } }
  if (['Escape','KeyP'].includes(e.code) && !e.repeat) pause();
  if (e.code === 'KeyR' && !e.repeat) { if (g.mode === 'ready') action(); else { retry(g); held = false; particles = []; overlay(); } }
});
window.addEventListener('keyup', e => { if (['Space','ArrowUp','KeyW'].includes(e.code)) release(); });
window.addEventListener('blur', () => { if(g.mode === 'playing') pause(); held = false; });
document.addEventListener('visibilitychange', () => { if(document.hidden && g.mode === 'playing') pause(); });
function line(x1,y1,x2,y2,color,width=1) { ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke(); }
function draw(now) {
  const accent = LEVELS[g.level].color, px = Math.min(170,W*.22), offset = g.x - px, pulse = reduced ? 0 : (Math.sin(now/260)+1)*.5;
  const bg = ctx.createLinearGradient(0,0,W,H); bg.addColorStop(0,'#10192e');bg.addColorStop(.5,'#151c3d');bg.addColorStop(1,'#151b31');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  // Slow parallax geometry makes the fixed runner's speed visible.
  for(let i=0;i<24;i++) {
    const x = ((i*193-g.x*.12)%(W+200)+W+200)%(W+200)-100, y = 80+(i*83)%(Math.max(100,ground-150));
    ctx.save();ctx.translate(x,y);ctx.rotate(i*.7 + (reduced?0:now*.00003));ctx.strokeStyle='#7584c21c';ctx.lineWidth=1;ctx.strokeRect(-13,-13,26+(i%3)*18,26+(i%3)*18);ctx.restore();
  }
  ctx.strokeStyle='#7688cd09';ctx.lineWidth=1;
  const grid = 55;
  for(let x=-(g.x*.3%grid);x<W;x+=grid) line(x,0,x,ground,'#8496e609');
  for(let y=ground%grid;y<ground;y+=grid) line(0,y,W,y,'#8496e609');
  for(let layer=0;layer<2;layer++) {
    ctx.fillStyle=layer?'#131e38':'#141e37';ctx.beginPath();ctx.moveTo(0,ground);
    for(let i=-1;i<W/130+2;i++) { const x=i*130-(g.x*(layer?.23:.1)%130);const y=ground-60-Math.sin(i*2.3+layer)*50-layer*20;ctx.lineTo(x,y);ctx.lineTo(x+65,y-35); }
    ctx.lineTo(W,ground);ctx.fill();
  }
  ctx.fillStyle='#0b1224';ctx.fillRect(0,ground,W,H-ground);
  line(0,ground,W,ground,accent,2); line(0,ground+6,W,ground+6,accent+'22');
  for(let x=-(g.x%55);x<W;x+=55) {line(x,ground+8,x-45,H,'#36486940');}
  for(let y=ground+25;y<H;y+=30) line(0,y,W,y,'#36486930');
  for(const o of g.obstacles) {
    const x=o.x-offset;if(x < -80 || x>W+80)continue;
    ctx.shadowBlur=reduced?0:12;ctx.shadowColor=o.type==='spike'?'#fd668e':accent;
    if(o.type==='ceiling') {
      const y = ground-o.bottom;
      ctx.fillStyle='#54203f';ctx.strokeStyle='#ff79a0';ctx.lineWidth=2;
      ctx.fillRect(x,y-o.h,o.w,o.h-10);ctx.strokeRect(x,y-o.h,o.w,o.h-10);
      for(let dx=0;dx<o.w;dx+=18){ctx.beginPath();ctx.moveTo(x+dx,y-10);ctx.lineTo(x+Math.min(dx+9,o.w),y);ctx.lineTo(x+Math.min(dx+18,o.w),y-10);ctx.closePath();ctx.fill();ctx.stroke();}
      ctx.fillStyle='#ffb0ca';ctx.font='bold 9px Arial';ctx.fillText('SHORT JUMP',x+8,y-o.h+18);
    } else if(o.type==='spike') {
      ctx.fillStyle='#572842';ctx.strokeStyle='#ff79a0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,ground);ctx.lineTo(x+o.w/2,ground-o.h);ctx.lineTo(x+o.w,ground);ctx.closePath();ctx.fill();ctx.stroke();
      line(x+o.w/2,ground-o.h+12,x+o.w/2,ground-10,'#ffb0ca',1.5);
    } else {
      ctx.fillStyle='#203c4e';ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.fillRect(x,ground-o.h,o.w,o.h);ctx.strokeRect(x,ground-o.h,o.w,o.h);
      ctx.strokeStyle=accent+'55';ctx.strokeRect(x+7,ground-o.h+7,o.w-14,o.h-14);
    }
    ctx.shadowBlur=0;
  }
  const finishX=LEVELS[g.level].length-offset;
  if(finishX<W+100) {
    ctx.fillStyle=accent+'22';ctx.fillRect(finishX,70,35,ground-70);
    line(finishX,70,finishX,ground,accent,4);ctx.fillStyle=accent;ctx.font='bold 12px Arial';ctx.fillText('FINISH',finishX-20,60);
  }
  if(g.practice && g.checkpoint>0) {
    const x=g.checkpoint-offset;line(x,ground,x,ground-75,accent,2);ctx.fillStyle=accent;ctx.fillRect(x,ground-75,22,14);
  }
  // Speed trail follows the rotating cube.
  if(g.mode !== 'dead') {
    if(!reduced) for(let i=6;i>0;i--){ctx.globalAlpha=(7-i)*.025;ctx.fillStyle=accent;ctx.fillRect(px-i*12,ground-g.y-SIZE+6,SIZE-12,SIZE-12);}
    ctx.globalAlpha=1;ctx.save();ctx.translate(px+SIZE/2,ground-g.y-SIZE/2);ctx.rotate(g.rotation);
    ctx.shadowColor=accent;ctx.shadowBlur=15+pulse*10;ctx.fillStyle=accent;ctx.fillRect(-17,-17,34,34);ctx.shadowBlur=0;ctx.strokeStyle='#e0fff6';ctx.lineWidth=2;ctx.strokeRect(-17,-17,34,34);
    ctx.fillStyle='#103231';ctx.fillRect(-10,-8,7,9);ctx.fillRect(4,-8,7,9);ctx.fillRect(-9,7,18,4);ctx.restore();
  }
  for(const p of particles) {ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;
  if(g.mode==='playing'&&g.x<600) {ctx.fillStyle='#c2cbe566';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillText('TAP LOW / HOLD HIGH',Math.min(W-100,px+260),ground-105);ctx.textAlign='left';}
}
function frame(now) {
  const delta = last ? Math.min((now-last)/1000,.06) : 0; last=now;
  accumulator += delta;
  while(accumulator >= 1/120) {
    const previous = g.mode;
    tick(g,1/120,held);
    if(previous==='playing' && g.mode!=='playing') {
      record(); held=false;
      if(g.mode==='dead') {
        tone(90,.25,'sawtooth',.07);
        const px=Math.min(170,W*.22);
        if(!reduced) for(let i=0;i<26;i++) particles.push({x:px+17,y:ground-g.y-17,vx:(Math.random()-.5)*400,vy:(Math.random()-.7)*400,life:1,size:3+Math.random()*5,color:LEVELS[g.level].color});
      } else {tone(523,.3);setTimeout(()=>tone(784,.4),150);}
      overlay();
    }
    accumulator -= 1/120;
  }
  if(g.mode==='playing') {
    const b=Math.floor(g.time / .43);
    if(b!==beat){beat=b;tone(b%4===0?65:130,.12,'sine',.09);if(b%2===0)tone([261.63,329.63,392,329.63,293.66,349.23,440,392][Math.floor(b/2)%8],.22,'triangle',.025);}
    refresh();
  }
  for(const p of particles){p.x+=p.vx*delta;p.y+=p.vy*delta;p.vy+=500*delta;p.life-=delta*1.7;}
  particles=particles.filter(p=>p.life>0);
  draw(now);requestAnimationFrame(frame);
}
window.render_game_to_text = () => JSON.stringify({mode:g.mode,level:g.level,practice:g.practice,progress:progress(),x:g.x,y:g.y,attempts:g.attempts,checkpoint:g.checkpoint,jumps:g.jumps,best,coordinates:'x increases right; y is height above ground'});
resize();overlay();requestAnimationFrame(frame);
