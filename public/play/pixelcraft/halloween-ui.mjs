import {isBuildWorld} from './build-guide.mjs';
import {B,ITEMS,RECIPES} from './data.mjs';
import {recipeNeeds,countItem,canCraft} from './core.mjs';
import {iconUrl} from './textures.mjs';
import {HALLOWEEN_RECIPES,halloweenState,halloweenMissions,craftHalloween,claimHalloween} from './halloween.mjs';
export function createHalloweenUI(api){
 const $=id=>document.getElementById(id);let wasPaused=false,selected=B.JACK;
 const picture=(id)=>`<img src="${iconUrl[id]}" alt="${ITEMS[id].name}">`;
 function render(message=''){
  const G=api.get(),play=G?.adventure&&!G.jump&&!isBuildWorld(G)&&!G.remoteReplica;
  $('halloweenMessage').textContent=message;
  const board=$('halloweenMissions');board.replaceChildren();
  const missions=play?halloweenMissions(G):[{name:'호박 수확',hint:'호박 3개 모으기',n:0,total:3},{name:'어둠을 밝힐 등불',hint:'잭오랜턴 3개 제작하기',n:0,total:3},{name:'등불 축제',hint:'잭오랜턴 3개 설치하기',n:0,total:3}];
  for(const [i,m] of missions.entries()){const row=document.createElement('div');row.className='festival-mission';row.innerHTML=`<span>${m.n>=m.total?'✓':String(i+1).padStart(2,'0')}</span><div><b>${m.name}</b><small>${m.hint}</small></div><strong>${Math.min(m.n,m.total)} / ${m.total}</strong>`;board.append(row);}
  const state=play?halloweenState(G):null,canClaim=play&&(state.claimed?missions.at(-1).n>=missions.at(-1).total:missions.slice(0,3).every(m=>m.n>=m.total));
  $('halloweenClaim').disabled=!canClaim;$('halloweenClaim').textContent=play?(state.claimed?`다음 미션 보상 받기 · ${missions.at(-1).serial}번`:'축제 보상 받기 · 다이아 3 + 황금 사과 3'):'숲 세계에서 미션을 할 수 있어';
  const list=$('halloweenRecipes');list.replaceChildren();
  for(const id of HALLOWEEN_RECIPES){const button=document.createElement('button');button.className=id===selected?'selected':'';button.innerHTML=picture(id)+`<span>${ITEMS[id].name}</span>`;button.onclick=()=>{selected=id;render();};list.append(button);}
  const recipe=RECIPES.find(r=>r.out[0]===selected),needs=recipeNeeds(recipe);
  $('halloweenRecipeDetail').innerHTML=`<h3>${picture(selected)}${ITEMS[selected].name} 제작법</h3><div class="festival-ingredients">${needs.map(g=>`<div>${picture(g.ids[0])}<b>${ITEMS[g.ids[0]].name+(g.ids.length>1?' 등':'')}</b><span>${g.n}개 ${play?`· 보유 ${countItem(G.player.inv,g.ids)}`:''}</span></div>`).join('<span class="plus">+</span>')}<span class="plus">→</span><div>${picture(selected)}<b>${ITEMS[selected].name}</b><span>${recipe.out[1]}개</span></div></div>`;
  $('halloweenCraft').disabled=!play||!canCraft(G.player.inv,recipe);$('halloweenCraft').textContent=play?(canCraft(G.player.inv,recipe)?'제작하기':'재료를 더 모아 줘'):'숲 세계에서 제작할 수 있어';
  $('halloweenIntro').textContent=play?'호박을 모아 등불을 켜고, 어두운 숲에 축제를 열어 줘.':'숲 세계를 시작하거나 이어 하면 미션과 제작을 할 수 있어. 진행은 세계마다 저장돼.';
  const festival=play&&halloweenState(G);if(festival?.claimed){const next=BigInt(festival.endless?.completed??'0')+1n;$('halloweenIntro').textContent=`끝없는 축제 ${next}번째 미션이 기다려! 미션은 계속 새로 만들어져. 보상도 모아 봐!`;}
  const forest=play&&G.adventure.dimension==='overworld'&&halloweenState(G).haunted;if(forest){const distance=Math.round(forest.x-G.player.x);$('halloweenIntro').textContent+=` · 속삭이는 안개 숲 ${Math.abs(distance)<20?'여기':`${distance<0?'←':'→'} ${Math.abs(distance)}칸`}`;}
 }
 function open(){const G=api.get();wasPaused=!!G?.paused;api.closePanel();if(G){G.paused=true;api.keys.clear();}render();$('halloweenDialog').hidden=false;$('halloweenClose').focus();}
 function close(){const G=api.get();$('halloweenDialog').hidden=true;if(G){G.paused=wasPaused;api.keys.clear();}}
 $('btnHalloween').onclick=open;$('halloweenButton').onclick=open;$('halloweenClose').onclick=close;
 $('halloweenCraft').onclick=()=>{const G=api.get();if(!G||G.remoteReplica)return;const result=craftHalloween(G,selected);api.hudDirty();api.save();render(result.text);};
 $('halloweenClaim').onclick=()=>{const G=api.get();if(!G||G.remoteReplica)return;const result=claimHalloween(G);api.hudDirty();api.save();render(result.text);};
 window.addEventListener('keydown',e=>{if(!$('halloweenDialog').hidden){e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();close();}}},true);
 return {open,close};
}
