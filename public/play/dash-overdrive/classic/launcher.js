'use strict';
const canvas=document.getElementById('canvas');
const status=document.getElementById('status');
const play=document.getElementById('play');
const selectedParameter=Number(new URLSearchParams(location.search).get('level'));
let selected=Number.isInteger(selectedParameter)&&selectedParameter>=1&&selectedParameter<=15?selectedParameter:6;
let ready=false,launching=false,phase='title',musicPlayer=null,musicReady=false,musicOn=false,musicEnabled=true,pendingSong=null,pendingStart=false,cuedSong=null;
const songs={1:{id:'tof8_p0F3kg',name:'Stereo Madness · ForeverBound'},2:{id:'N9vDTYZpqXM',name:'Back on Track · DJVI'},3:{id:'_WPmsD0tKlA',name:'Polargeist · Step'},4:{id:'FnXabH2q2A0',name:'Dry Out · DJVI'},5:{id:'TZULkgQPHt0',name:'Base After Base · DJVI'},6:{id:'fLnF-QnR1Zw',name:"Can't Let Go · DJVI"},7:{id:'NcZMExixvDg',name:'Jumper · Waterflame'},8:{id:'EFYy36tcp7M',name:'Time Machine · Waterflame'},9:{id:'QsCHWlCgJt4',name:'Cycles · DJVI'},10:{id:'PSvYfVGyQfw',name:'xStep · DJVI'},11:{id:'iNaBLxSNFWU',name:'Clutterfunk · Waterflame'},12:{id:'1_vKqgcFF4w',name:'Theory of Everything · DJ-Nate'},13:{id:'y8nVfW_7rsw',name:'Electroman Adventures · Waterflame'},14:{id:'TiwSjh7SI5Y',name:'Clubstep · DJ-Nate'},15:{id:'n0CwuexLakU',name:'Electrodynamix · DJ-Nate'}};
function updateChoice(){
 document.documentElement.style.setProperty('--accent',selected===6?'#e4a8ff':selected===7?'#a7c3ff':'#72e8c3');
 for(const button of document.querySelectorAll('[data-level]')){
  const active=Number(button.dataset.level)===selected;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
 }
 if(ready)play.textContent=`${selected}단계 시작하기 ↗`;
}
for(const button of document.querySelectorAll('[data-level]'))button.addEventListener('click',()=>{
 if(launching)return;
 selected=Number(button.dataset.level);
 updateChoice();
 if(musicOn&&musicReady)playSelectedSong();
 else cueSelectedSong();
});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function key(type,keyName,code,keyCode){window.dispatchEvent(new KeyboardEvent(type,{key:keyName,code,keyCode,which:keyCode,bubbles:true,cancelable:true}));}
async function tapSpace(){key('keydown',' ','Space',32);await wait(90);key('keyup',' ','Space',32);await wait(130);}
async function clickLeftArrow(){
 const box=canvas.getBoundingClientRect();
 const x=box.left+box.width*(93/2304),y=box.top+box.height*.5;
 canvas.dispatchEvent(new MouseEvent('mousemove',{clientX:x,clientY:y,bubbles:true}));
 canvas.dispatchEvent(new MouseEvent('mousedown',{clientX:x,clientY:y,button:0,buttons:1,bubbles:true}));
 await wait(90);
 canvas.dispatchEvent(new MouseEvent('mouseup',{clientX:x,clientY:y,button:0,buttons:0,bubbles:true}));
 await wait(130);
}
var Module={
 canvas,
 locateFile:path=>'engine/'+path+'?v=classics-15-platforms-20261029',
 setStatus(message){if(!ready&&message)status.textContent='클래식 게임을 불러오고 있어…';},
 print(){},
 printErr(message){console.error(message);},
 onAbort(){phase='error';status.textContent='게임을 불러오지 못했어. 새로고침해서 다시 시도해 줘.';},
 postRun:[()=>{
  ready=true;phase='title';play.disabled=false;updateChoice();status.textContent='원작 타이틀에서 플레이를 눌러도 돼.';
  const nativeOpen=FS.open;
  FS.open=function(path,...args){
   const match=typeof path==='string'&&path.match(/res\/leveldata\/(\d+)\.level$/);
   if(match){const level=Number(match[1])+1;if(level>=1&&level<=15){selected=level;updateChoice();if(musicReady&&musicEnabled)playSelectedSong();else if(musicEnabled){pendingSong=level;pendingStart=true;status.textContent='원곡 플레이어를 준비하고 있어. ♪ 버튼에서 YouTube로 들을 수도 있어.';}}}
   return nativeOpen.call(this,path,...args);
  };
 }],
};
const launcher=document.getElementById('launcher');
const musicBox=document.getElementById('music-box');
const musicToggle=document.getElementById('music-toggle');
function playSelectedSong(restart=false){
 if(!musicReady)return;
 musicBox.hidden=false;
 musicOn=true;musicToggle.textContent='♪ 원곡 재생 중';
 document.getElementById('music-name').textContent=songs[selected].name;
 document.getElementById('music-source').href=`https://www.youtube.com/watch?v=${songs[selected].id}`;
 if(cuedSong!==selected){musicPlayer.loadVideoById({videoId:songs[selected].id,startSeconds:0});cuedSong=selected;}
 else{if(restart)musicPlayer.seekTo(0,true);musicPlayer.playVideo();}
}
function cueSelectedSong(){
 if(!musicReady||!musicEnabled)return;
 document.getElementById('music-name').textContent=songs[selected].name;
 document.getElementById('music-source').href=`https://www.youtube.com/watch?v=${songs[selected].id}`;
 if(cuedSong!==selected){musicPlayer.cueVideoById({videoId:songs[selected].id,startSeconds:0});cuedSong=selected;}
}
musicToggle.addEventListener('click',()=>{
 if(!musicReady){window.open(`https://www.youtube.com/watch?v=${songs[selected].id}`,'_blank','noopener,noreferrer');status.textContent='원곡을 YouTube에서 열었어.';return;}
 musicEnabled=!musicEnabled;
 if(musicEnabled)playSelectedSong();else{musicPlayer.pauseVideo();musicOn=false;musicToggle.textContent=musicEnabled?'♪ 원곡 재생 중':'♪ 원곡 켜기';}
});
document.getElementById('music-stop').addEventListener('click',()=>{
 if(musicReady)musicPlayer.stopVideo();musicOn=false;musicEnabled=false;musicBox.hidden=true;musicToggle.textContent='♪ 원곡 켜기';
});
window.onYouTubeIframeAPIReady=()=>{
 musicPlayer=new YT.Player('yt-player',{width:'200',height:'200',videoId:songs[selected].id,playerVars:{controls:1,playsinline:1,rel:0,origin:location.origin},events:{onReady(){musicReady=true;musicToggle.disabled=false;musicToggle.textContent=musicEnabled?'♪ 원곡 켜짐':'♪ 원곡 켜기';play.disabled=false;if(pendingSong){selected=pendingSong;pendingSong=null;}if(pendingStart&&musicEnabled){pendingStart=false;playSelectedSong();}else cueSelectedSong();},onStateChange(event){if(event.data===YT.PlayerState.PLAYING){musicOn=true;musicToggle.textContent='♪ 원곡 재생 중';}if(event.data===YT.PlayerState.PAUSED){musicOn=false;musicEnabled=false;musicToggle.textContent='♪ 원곡 켜기';}},onError(){status.textContent='이 영상은 재생되지 않아. 원곡 출처 링크에서 확인해 줘.';}}});
};
document.getElementById('select').addEventListener('click',()=>{
 launcher.hidden=!launcher.hidden;
 document.getElementById('select').textContent=launcher.hidden?'단계 선택':'타이틀로 돌아가기';
});
play.addEventListener('click',async()=>{
 if(!ready||launching)return;
 launching=true;play.disabled=true;phase='selecting';
 status.textContent=`${selected}단계의 원작 맵을 여는 중…`;
 try{
  canvas.focus();
  await tapSpace();
  const leftMoves=(16-selected)%15;
  for(let i=0;i<leftMoves;i++)await clickLeftArrow();
  phase='selected';
  await tapSpace();
  launcher.hidden=true;
  document.getElementById('select').textContent='단계 선택';
  document.getElementById('now-playing').textContent=`${String(selected).padStart(2,'0')} / ${['','STEREO MADNESS','BACK ON TRACK','POLARGEIST','DRY OUT','BASE AFTER BASE',"CAN'T LET GO",'JUMPER','TIME MACHINE','CYCLES','XSTEP','CLUTTERFUNK','THEORY OF EVERYTHING','ELECTROMAN ADVENTURES','CLUBSTEP','ELECTRODYNAMIX'][selected]}`;
  canvas.focus();phase='playing';
 }catch(error){
  phase='error';status.textContent='시작 중 문제가 생겼어. 새로고침해서 다시 시도해 줘.';console.error(error);
 }finally{launching=false;play.disabled=false;}
});
document.getElementById('full').addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}
});
let touched=false;
canvas.addEventListener('touchstart',event=>{
 event.preventDefault();if(phase!=='playing')return;
 touched=true;canvas.focus();key('keydown',' ','Space',32);
},{passive:false});
function releaseTouch(){if(touched){key('keyup',' ','Space',32);touched=false;}}
canvas.addEventListener('touchend',releaseTouch);
canvas.addEventListener('touchcancel',releaseTouch);
window.addEventListener('blur',()=>{key('keyup',' ','Space',32);releaseTouch();});
window.render_classic_status=()=>JSON.stringify({phase,selected,ready,music:musicOn,canvas:{width:canvas.width,height:canvas.height},engine:'Bad-GD-Clone'});
updateChoice();
