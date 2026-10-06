// 2인 온라인 방. 모든 게임이 같이 쓰는 net 서버(@inhyuk/net Room)로 메시지를 주고받는다.
// 서버는 방 만들기, 들어오고 나가기, 핑을 맡고, 이 파일은 게임 쪽 약속(hello/welcome)만 맡는다.
//   참가자 → 방장: {type:'hello',save}  들어오자마자 한 번
//   방장 → 참가자: {type:'welcome'}      준비가 끝나면 한 번
// 그 뒤에는 online.mjs 가 input(참가자)과 frame(방장)을 1초에 15번 보낸다.
import {Room,DEFAULT_SERVER,normaliseCode,roomCode} from '../../packages/net/index.mjs';
export {normaliseCode,roomCode};
export const NET_GAME='free-drive';
const LOOPBACK=/^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/;
// 서버 주소는 보통 기본값. 개발과 테스트에서만 ?net=http://127.0.0.1:8787 (내 컴퓨터 주소만) 또는 VITE_NET_SERVER 로 바꾼다.
export function serverUrl(search='',env={}){
 let q=null;try{q=new URLSearchParams(search).get('net');}catch{/* 주소가 이상하면 기본값 */}
 if(q&&LOOPBACK.test(q))return q.replace(/\/+$/,'');
 if(typeof env.VITE_NET_SERVER==='string'&&env.VITE_NET_SERVER)return env.VITE_NET_SERVER.replace(/\/+$/,'');
 return DEFAULT_SERVER;
}
export function safeInput(value){return {gas:value?.gas===true,brake:value?.brake===true,steer:value?.steer===-1?-1:value?.steer===1?1:0};}
// net 서버의 한국어 안내를 이 게임 말투로 바꾼다.
const FRIENDLY={
 '방 코드 여섯 글자를 적어 줘.':'방 코드 여섯 글자를 입력해 주세요.',
 '방을 만들지 못했어. 다시 해 볼래?':'방을 만들지 못했어요. 다시 시도해 주세요.',
 '방 서버에 연결하지 못했어. 인터넷을 확인해 줘.':'방 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
 '연결 시간이 너무 오래 걸려. 인터넷을 확인해 줘.':'연결 시간이 초과됐어요. 인터넷 연결을 확인해 주세요.',
 '그 코드의 방을 찾을 수 없어.':'그 코드의 방을 찾을 수 없어요.',
 '방 서버와 연결이 끊겼어. 다시 해 볼래?':'방 서버와 연결이 끊겼어요. 혼자 플레이로 돌아갑니다.',
};
export const friendly=message=>FRIENDLY[message]??(/명이야/.test(message)?'이 방은 이미 2명이에요. 다른 방을 만들어 주세요.':message);
export class DriveRoom{
 // options: server(기본 wss://net.seonn.workers.dev), connect, fetch (테스트용)
 constructor(hooks={},options={}){
  this.hooks=hooks;this.generation=0;this.role='';this.status='offline';this.ready=false;this.partner='';this.code='';
  this.sent=[];this.peak=0;this.total=0;this.dropped=0;this.biggest=0;
  this.net=new Room({status:(s,m)=>this.netStatus(s,m),join:id=>this.joined(id),depart:id=>this.departed(id),host:id=>this.hostChanged(id),message:(data,from)=>this.received(data,from),error:code=>this.netError(code)},{game:NET_GAME,maxPlayers:2,...options});
 }
 get host(){return this.role==='host';}get guest(){return this.role==='guest';}get active(){return !!this.role;}
 statusChanged(status,message=''){this.status=status;this.hooks.status?.(status,message);}
 async open(code){
  this.leave();
  if(code&&normaliseCode(code).length!==6){this.statusChanged('error','방 코드 여섯 글자를 입력해 주세요.');return;}
  const generation=++this.generation;this.role=code?'guest':'host';
  const opened=this.net.open(code);this.code=this.net.code;
  try{await opened;}catch{if(generation===this.generation&&this.role)this.reset();return;/* status 에 이유가 있다 */}
  if(generation!==this.generation||!this.role)return;
  this.code=this.net.code;
  if(this.guest&&!this.ready){clearTimeout(this.handshake);this.handshake=setTimeout(()=>{if(this.guest&&!this.ready)this.fail('방이 응답하지 않아요. 코드를 확인하고 다시 시도해 주세요.');},15000);}
  if(this.host&&!this.ready)this.statusChanged('waiting');
 }
 netStatus(status,message){
  // connected/waiting 은 게임 약속(hello/welcome)으로 직접 정한다.
  if(status==='connecting'){this.statusChanged('connecting');return;}
  if(status==='error'){const wasActive=this.reset();if(wasActive)this.hooks.depart?.();this.statusChanged('error',friendly(message));}
 }
 joined(id){if(this.guest&&id===this.net.hostId){this.partner=id;this.net.sendTo(id,{type:'hello',save:this.hooks.save?.()});this.count();}}
 departed(id){
  if(!id||!this.role)return;// 내가 나간 것은 leave() 가 처리한다
  if(id!==this.partner)return;// 인사(hello) 전에 나간 사람은 모른 척한다
  if(this.host){const was=this.ready;this.ready=false;this.partner='';if(was)this.hooks.depart?.();this.statusChanged('waiting','친구가 나갔어요. 새 친구가 같은 코드로 들어올 수 있어요.');}
  else this.fail('방장과 연결이 끊겼어요. 혼자 플레이로 돌아갑니다.');
 }
 // 방장이 나가면 서버가 참가자를 새 방장으로 정한다. 교통과 경찰은 방장 기기에만 있으므로 이어받지 않고 끝낸다.
 hostChanged(id){if(this.guest&&id===this.net.id)this.fail('방장과 연결이 끊겼어요. 혼자 플레이로 돌아갑니다.');}
 received(data,from){
  if(!this.role||!data||typeof data!=='object')return;
  if(this.host&&data.type==='hello'){
   if(this.ready)return;// 2명 방이라 다른 사람이 올 수 없지만 한 번만 받는다
   this.ready=true;this.partner=from;this.hooks.join?.(data.save);this.statusChanged('connected');this.net.sendTo(from,{type:'welcome'});this.count();return;
  }
  if(this.guest&&data.type==='welcome'&&from===this.partner){if(!this.ready){this.ready=true;clearTimeout(this.handshake);this.statusChanged('connected');}return;}
  if(this.ready&&from===this.partner)this.hooks.message?.(data);
 }
 netError(code){if(code==='rate'||code==='too-big')this.dropped++;}
 count(){const now=Date.now();this.total++;this.sent.push(now);while(this.sent.length&&now-this.sent[0]>=1000)this.sent.shift();this.peak=Math.max(this.peak,this.sent.length);}
 send(message){if(!this.ready||!this.partner)return false;const ok=this.net.sendTo(this.partner,message);if(ok){this.count();this.biggest=Math.max(this.biggest,JSON.stringify(message).length);}return ok;}
 // 최근 1초에 보낸 메시지 수(핑 빼고), 가장 많았던 1초, 모두 보낸 수, 서버가 버린 수, 가장 큰 메시지 글자 수 (서버 한도 16KB)
 rate(){const now=Date.now();while(this.sent.length&&now-this.sent[0]>=1000)this.sent.shift();return {now:this.sent.length,peak:this.peak,total:this.total,dropped:this.dropped,biggest:this.biggest};}
 reset(){const was=!!this.role;clearTimeout(this.handshake);this.role='';this.code='';this.ready=false;this.partner='';return was;}
 fail(message){this.leave();this.statusChanged('error',message);}
 leave(){
  const wasActive=this.active;this.generation++;this.reset();
  this.net.leave();
  if(wasActive)this.hooks.depart?.();
  if(this.status!=='offline')this.statusChanged('offline');
 }
}
