import {SONGS,compose,newRun,hit,expire,accuracy,releaseHold,updateHolds} from './core.mjs';
import {Music} from './audio.mjs';
const $=id=>document.getElementById(id), canvas=$('canvas'),ctx=canvas.getContext('2d'),music=new Music();
const colors={PERFECT:'#b6f36a',GREAT:'#74dbd4',GOOD:'#87aaff',BAD:'#f9b669',MISS:'#f77f8d',HOLD:'#f5e6a4'};
let selected=SONGS[0],chart=compose(selected),run=newRun(chart),phase='select',judgment='',judgmentAt=-99,flashes=[-99,-99,-99,-99],particles=[],w=0,h=0,starting=false,recordBook={};
try{recordBook=JSON.parse(localStorage.getItem('pulse-rush-best-v2-holds')||'{}');}catch{}
const inputs=[new Set(),new Set(),new Set(),new Set()];
function clearInputs(){for(let lane=0;lane<4;lane++){inputs[lane].clear();document.querySelector(`[data-lane="${lane}"]`).classList.remove('pressed');}}
function gameTime(){return time()-Number($('offset').value||0)/1000;}
function time(){return phase==='select'?0:music.time;}
function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);w=rect.width;h=rect.height;canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
new ResizeObserver(resize).observe(canvas);
function list(){ $('songs').innerHTML=SONGS.map(s=>`<button class="song ${s.id===selected.id?'selected':''}" data-song="${s.id}" aria-pressed="${s.id===selected.id}" style="--song-color:${s.color}"><span class="song-number">${String(s.id+1).padStart(2,'0')}</span><span class="song-cover" aria-hidden="true">${['◒','✳','≈','✦','▥','▧','☽','✿','ϟ','✷'][s.id]}</span><span class="song-info"><strong>${s.title}</strong><small>${s.genre}${recordBook[s.id]?' · BEST '+recordBook[s.id].toFixed(1)+'%':''}</small></span><span class="song-bpm">${s.bpm}<small>BPM</small></span><span class="song-arrow">${s.id===selected.id?'▶':'↗'}</span></button>`).join('');}
function select(id){if(phase==='playing'||phase==='paused'||starting)return;selected=SONGS[id];chart=compose(selected);run=newRun(chart);phase='select';document.documentElement.style.setProperty('--accent',selected.color);$('track-title').textContent=selected.title;$('track-meta').textContent=`${selected.name} / ${selected.bpm} BPM / ${Math.floor(chart.duration/60)}:${String(Math.floor(chart.duration%60)).padStart(2,'0')} / ${chart.notes.length} TILES`;$('difficulty').textContent=id<3?'EASY':id<6?'NORMAL':id<9?'HARD':'EXPERT';$('overlay').hidden=false;$('intro-panel').hidden=false;$('pause-panel').hidden=true;$('result-panel').hidden=true;judgment='';particles=[];list();stats();}
$('songs').addEventListener('click',e=>{const btn=e.target.closest('[data-song]');if(btn)select(Number(btn.dataset.song));});
function stats(){ $('score').textContent=String(run.score).padStart(6,'0');$('combo').innerHTML=run.maxCombo+' <small>×</small>';$('progress').innerHTML=Math.floor(Math.max(0,Math.min(100,time()/chart.duration*100)))+'<small>%</small>';}
async function start(){if(starting)return;starting=true;$('start').disabled=true;try{await music.stop();await music.init();music.volume(Number($('volume').value));chart=compose(selected);chart.songId=selected.id;run=newRun(chart);clearInputs();music.start(chart);phase='playing';judgment='';judgmentAt=-99;particles=[];flashes=[-99,-99,-99,-99];$('overlay').hidden=true;$('pause').disabled=false;$('restart').disabled=false;document.body.classList.add('playing');$('pause').innerHTML='Ⅱ <span>일시정지</span>';document.querySelector('.player').scrollIntoView({block:'start',behavior:'smooth'});stats();}catch(error){$('intro-panel').querySelector('p').textContent='소리를 시작하지 못했어요. 플레이 시작을 다시 눌러 주세요.';console.error(error);}finally{starting=false;$('start').disabled=false;}}
$('start').onclick=start;$('restart').onclick=start;
async function pause(){if(starting)return;if(phase==='playing'){phase='paused';clearInputs();await music.pause();$('overlay').hidden=false;$('intro-panel').hidden=true;$('pause-panel').hidden=false;$('result-panel').hidden=true;$('pause').textContent='▷ 계속하기';}else if(phase==='paused'){for(const n of run.notes)if(n.holding&&!n.judgment)n.resumeGrace=gameTime()+.6;await music.resume();phase='playing';$('overlay').hidden=true;$('pause').innerHTML='Ⅱ <span>일시정지</span>';}}
$('pause').onclick=pause;$('resume').onclick=pause;
$('leave').onclick=async()=>{await music.stop();phase='select';document.body.classList.remove('playing');$('pause').disabled=true;$('restart').disabled=true;$('pause').innerHTML='Ⅱ <span>일시정지</span>';select(selected.id);};
$('volume').oninput=e=>music.volume(Number(e.target.value));
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}};
function feedback(result,lane){judgment=result;judgmentAt=time();if(lane!=null&&result!=='MISS')for(let i=0;i<14;i++)particles.push({x:(lane+.5)*w/4,y:h-68,vx:(Math.random()-.5)*180,vy:-40-Math.random()*170,life:.65,color:colors[result]});}
function press(lane,source){if(phase!=='playing')return;const wasHeld=inputs[lane].size>0;inputs[lane].add(source);flashes[lane]=time();if(!wasHeld){const result=hit(run,lane,gameTime());if(result)feedback(result,lane);}document.querySelector(`[data-lane="${lane}"]`).classList.add('pressed');stats();}
function release(lane,source){inputs[lane].delete(source);if(inputs[lane].size)return;document.querySelector(`[data-lane="${lane}"]`).classList.remove('pressed');if(phase==='playing'){const result=releaseHold(run,lane,gameTime());if(result)feedback(result,lane);stats();}}
const keyMap={KeyD:0,KeyF:1,KeyJ:2,KeyK:3};
window.addEventListener('keydown',e=>{if(e.target.matches('input'))return;if(e.code==='Escape'){e.preventDefault();pause();return;}if(e.code in keyMap){e.preventDefault();if(!e.repeat)press(keyMap[e.code],e.code);}});
window.addEventListener('keyup',e=>{if(e.code in keyMap)release(keyMap[e.code],e.code);});
for(const btn of document.querySelectorAll('[data-lane]')){const lane=Number(btn.dataset.lane);btn.onpointerdown=e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);press(lane,e.pointerId);};btn.onpointerup=btn.onpointercancel=btn.onlostpointercapture=e=>release(lane,e.pointerId);}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='playing')pause();});window.addEventListener('blur',()=>{if(phase==='playing')pause();else clearInputs();});
async function finish(){phase='result';document.body.classList.remove('playing');$('pause').disabled=true;const acc=accuracy(run),grade=acc>=98?'S+':acc>=93?'S':acc>=85?'A':acc>=70?'B':acc>=50?'C':'D';const best=acc>(recordBook[selected.id]??-1);if(best){recordBook[selected.id]=acc;try{localStorage.setItem('pulse-rush-best-v2-holds',JSON.stringify(recordBook));}catch{}}
 $('overlay').hidden=false;$('intro-panel').hidden=true;$('pause-panel').hidden=true;$('result-panel').hidden=false;
 $('result-panel').innerHTML=`<div class="eyebrow">${best?'NEW PERSONAL BEST':'TRACK COMPLETE'}</div><h2>${selected.title}</h2><div class="result-grade">${grade}</div><p>정확도 ${acc.toFixed(1)}% · 최고 ${run.maxCombo} 콤보<br>${run.score.toLocaleString()} 점${run.counts.MISS===0&&run.counts.BAD===0?' · FULL COMBO!':''}</p><div class="result-counts">${Object.entries(run.counts).map(([name,count])=>`<span style="color:${colors[name]}">${name}<b>${count}</b></span>`).join('')}</div><button id="retry" class="primary">다시 도전 ↗</button><button id="next" class="secondary">${selected.id<9?'다음 곡 →':'첫 번째 곡으로 →'}</button><button id="back" class="secondary">곡 선택으로</button>`;
 $('retry').onclick=start;$('next').onclick=()=>select((selected.id+1)%10);$('back').onclick=()=>select(selected.id);list();await music.stop();}
function rounded(x,y,width,height,r=4){ctx.beginPath();ctx.roundRect(x,y,width,height,r);}
let last=performance.now();function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;const t=time();
 if(phase==='playing'){music.tick();for(const completed of updateHolds(run,gameTime(),new Set(inputs.flatMap((sources,lane)=>sources.size?[lane]:[]))))feedback(completed.result,completed.lane);if(expire(run,gameTime()))feedback('MISS');if(t>=chart.duration){stats();finish();}else stats();}
 ctx.clearRect(0,0,w,h);const line=h-68,laneW=w/4,travel=1.65;
 const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#0e1411');bg.addColorStop(1,'#1c2a1b');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 for(let lane=0;lane<4;lane++){ctx.fillStyle=lane%2?'#ffffff03':'#00000015';ctx.fillRect(lane*laneW,0,laneW,line);ctx.strokeStyle='#69895c20';ctx.beginPath();ctx.moveTo(lane*laneW,0);ctx.lineTo(lane*laneW,line);ctx.stroke();if(t-flashes[lane]<.17||inputs[lane].size){const glow=ctx.createLinearGradient(0,line-150,0,line);glow.addColorStop(0,'transparent');glow.addColorStop(1,selected.color+'66');ctx.fillStyle=glow;ctx.fillRect(lane*laneW,line-150,laneW,150);}}
 const gridOffset=(Math.max(t,0)*line/travel)%75;ctx.strokeStyle='#7c9c6b12';for(let y=gridOffset;y<line;y+=75){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 if(phase==='playing'||phase==='paused'){
 for(const n of run.notes){if(n.judgment)continue;const delta=n.time-t;if(delta>travel+.1)break;if(delta<-.22&&!n.holding)continue;const y=n.holding?line:line-delta/travel*line;ctx.save();ctx.shadowColor=selected.color;ctx.shadowBlur=n.holding?22:12;
 if(n.endTime){const tail=Math.max(-20,line-(n.endTime-t)/travel*line);ctx.fillStyle=selected.color+(n.holding?'aa':'55');rounded(n.lane*laneW+laneW*.27,tail,laneW*.46,Math.max(2,y-tail),5);ctx.fill();ctx.strokeStyle=selected.color;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#f5e6a4';rounded(n.lane*laneW+laneW*.27,tail,laneW*.46,5,2);ctx.fill();}
 ctx.fillStyle=n.lane%2===0?selected.color:'#dcebc9';rounded(n.lane*laneW+10,y-9,laneW-20,17,4);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#ffffff90';ctx.fillRect(n.lane*laneW+15,y-7,laneW-30,2);
 if(n.endTime){ctx.textAlign='center';ctx.fillStyle='#23301c';ctx.font='bold 9px sans-serif';ctx.fillText(n.holding?'HOLDING':'HOLD',n.lane*laneW+laneW/2,y+3);}ctx.restore();}
 if(run.combo>1){ctx.textAlign='center';ctx.fillStyle='#dfeacd';ctx.font='bold 48px "Space Grotesk", sans-serif';ctx.fillText(run.combo,w/2,105);ctx.fillStyle='#92a283';ctx.font='10px sans-serif';ctx.fillText('C O M B O',w/2,125);}
 if(t<2&&phase==='playing'){ctx.textAlign='center';ctx.fillStyle=selected.color;ctx.font='bold 70px sans-serif';ctx.fillText(t<0?'READY':String(Math.ceil(2-t)),w/2,line*.5);}
 }
 if(t-judgmentAt<.6&&phase!=='select'){ctx.textAlign='center';ctx.fillStyle=colors[judgment];ctx.font='bold 25px "Space Grotesk", sans-serif';ctx.fillText(judgment,w/2,line*.6);ctx.font='11px sans-serif';ctx.fillText({PERFECT:'퍼펙트',GREAT:'그레잇',GOOD:'굿',BAD:'배드',MISS:'미스',HOLD:'끝까지 꾹 누르세요!'}[judgment]||'',w/2,line*.6+22);}
 if(phase==='playing'){particles=particles.filter(p=>p.life>0);for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;ctx.globalAlpha=Math.max(0,p.life/.65);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3);}ctx.globalAlpha=1;}
 ctx.shadowColor=selected.color;ctx.shadowBlur=14;ctx.fillStyle=selected.color;ctx.fillRect(0,line-2,w,2);ctx.shadowBlur=0;
 requestAnimationFrame(frame);
}
select(0);requestAnimationFrame(frame);

window.render_game_to_text=()=>JSON.stringify({phase,songId:selected.id,time:time(),duration:chart.duration,total:run.total,score:run.score,combo:run.combo,maxCombo:run.maxCombo,counts:run.counts,notes:run.notes.filter(n=>!n.judgment).slice(0,12).map(n=>({time:n.time,lane:n.lane,endTime:n.endTime,holding:!!n.holding}))});
