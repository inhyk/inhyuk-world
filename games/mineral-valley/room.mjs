// 두 사람을 잇는 방. 모든 게임이 같이 쓰는 net 서버(@inhyuk/net)가 메시지를 전해 준다.
// 쓰는 법은 예전 PeerJS 방과 같다: open(code) / send / leave, hooks status / join / depart / message.
// 방장이 계곡을 계산하므로 방장이 나가면 손님도 혼자 플레이로 돌아간다(방장을 넘기지 않는다).
import { Room,DEFAULT_SERVER,MESSAGES,normaliseCode } from '../../packages/net/index.mjs';
export { normaliseCode };
export const NET_GAME='mineral-valley';
const LOOPBACK=/^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/;
// 서버 주소는 기본값. 개발과 테스트에서만 주소 뒤 ?net=http://127.0.0.1:8787 (내 컴퓨터 주소만) 또는 VITE_NET_SERVER 로 바꾼다.
export function serverUrl(search='',env={}){
 let q=null;try{q=new URLSearchParams(search).get('net');}catch{}
 if(q&&LOOPBACK.test(q))return q.replace(/\/+$/,'');
 if(typeof env.VITE_NET_SERVER==='string'&&env.VITE_NET_SERVER)return env.VITE_NET_SERVER.replace(/\/+$/,'');
 return DEFAULT_SERVER;
}
// net 서버의 반말 안내를 이 게임 말투로 바꾼다.
const POLITE=new Map([
 [MESSAGES.code,'방 코드 여섯 글자를 입력해 주세요.'],
 [MESSAGES.create,'방을 만들지 못했어요. 다시 시도해 주세요.'],
 [MESSAGES.network,'방 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.'],
 [MESSAGES.timeout,'연결 시간이 초과됐어요. 인터넷 연결을 확인해 주세요.'],
 [MESSAGES.notFound,'그 코드의 방을 찾을 수 없어요.'],
 [MESSAGES.full(2),'이 방은 이미 2명이에요. 다른 방을 만들어 주세요.'],
 [MESSAGES.lost,'방 서버와 연결이 끊겼어요. 혼자 플레이로 돌아갑니다.'],
]);
export const polite=message=>POLITE.get(message)??message;
// 친구가 보낸 조작은 언제나 걸러서 쓴다.
export function safeMove(value){
 const axis=n=>n===1?1:n===-1?-1:0;
 return {mx:axis(value?.mx),mz:axis(value?.mz),yaw:Number.isFinite(value?.yaw)?Math.max(-9,Math.min(9,value.yaw)):0};
}
export class ValleyRoom{
 // options: server(기본 DEFAULT_SERVER), fetch, connect (테스트용)
 constructor(hooks={},options={}){
  this.hooks=hooks;this.role='';this.status='offline';this.partner='';this.closing=false;
  this.net=new Room({
   status:(s,m)=>this.changed(s,m),
   join:id=>this.joined(id),
   depart:id=>this.departed(id),
   message:(data,from)=>{if(from===this.partner&&data&&typeof data==='object')this.hooks.message?.(data);},
   error:code=>this.hooks.error?.(code),
  },{game:NET_GAME,maxPlayers:2,...options});
 }
 get code(){return this.net.code;}
 get host(){return this.role==='host';}
 get guest(){return this.role==='guest';}
 get active(){return !!this.role;}
 // 친구와 실제로 이어졌는지
 get ready(){return !!this.partner&&this.net.ready;}
 statusChanged(status,message=''){this.status=status;this.hooks.status?.(status,message);}
 changed(status,message){
  if(this.closing)return; // 내가 나가는 중이면 leave 가 알린다
  if(status==='offline'){this.reset();this.statusChanged('offline');return;}
  if(status==='error'){this.reset();this.statusChanged('error',polite(message));return;}
  // connected 는 joined 에서, 친구가 나간 waiting 은 departed 에서 알린다.
  if(status==='connected'||(status==='waiting'&&message))return;
  this.statusChanged(status);
 }
 async open(code){
  this.leave();
  this.role=code?'guest':'host';
  try{await this.net.open(code||undefined);}
  catch(error){
   const message=polite(error.message);
   if(this.role){this.role='';this.statusChanged('error',message);} // 서버에 가기 전에 멈춘 경우(코드가 짧음)
   throw Error(message);
  }
 }
 joined(id){
  if(this.partner)return; // 방은 2명이라 오지 않지만 혹시 와도 무시
  this.partner=id;
  if(this.host)this.hooks.join?.();
  this.statusChanged('connected');
 }
 departed(id){
  if(!id||id!==this.partner)return; // 내가 나간 것은 leave/reset 에서 처리
  if(this.guest){this.fail('방장과 연결이 끊겼어요. 혼자 플레이로 돌아갑니다.');return;}
  this.partner='';this.hooks.depart?.();
  this.statusChanged('waiting','친구가 나갔어요. 새 친구가 같은 코드로 들어올 수 있어요.');
 }
 send(message){return this.ready&&this.net.send(message);}
 fail(message){this.leave();this.statusChanged('error',message);}
 // 서버 쪽에서 끊겼을 때: net.Room 은 이미 닫혔으니 내 상태만 비운다
 reset(){
  const wasActive=this.active;this.partner='';this.role='';
  if(wasActive)this.hooks.depart?.();
 }
 leave(){
  const wasActive=this.active;
  this.closing=true;this.partner='';this.role='';
  try{this.net.leave();}finally{this.closing=false;}
  if(wasActive)this.hooks.depart?.();
  if(this.status!=='offline')this.statusChanged('offline');
 }
}
