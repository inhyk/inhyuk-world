const PREFIX='free-drive-v1-',ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normaliseCode=value=>String(value??'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
export function roomCode(){const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);return [...bytes].map(n=>ALPHABET[n%ALPHABET.length]).join('');}
export function safeInput(value){return {gas:value?.gas===true,brake:value?.brake===true,steer:value?.steer===-1?-1:value?.steer===1?1:0};}
export class DriveRoom{
 constructor(hooks={},options={}){this.hooks=hooks;this.options=options;this.generation=0;this.role='';this.code='';this.status='offline';this.peer=null;this.connection=null;this.ready=false;this.lastSeen=0;}
 get host(){return this.role==='host';}get guest(){return this.role==='guest';}get active(){return !!this.role;}
 statusChanged(status,message=''){this.status=status;this.hooks.status?.(status,message);}
 async open(code){
  this.leave();const generation=this.generation;this.role=code?'guest':'host';this.code=code?normaliseCode(code):roomCode();
  if(this.code.length!==6){this.leave();throw Error('방 코드 여섯 글자를 입력해 주세요.');}
  this.statusChanged('connecting');
  try{
   const {Peer}=await import('peerjs');if(generation!==this.generation)return;
   this.peer=new Peer(this.host?PREFIX+this.code:undefined,{debug:0,...this.options});
   const peer=this.peer;
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('연결 시간이 초과됐어요. 인터넷 연결을 확인해 주세요.')),15000);
    peer.on('open',()=>{clearTimeout(timer);resolve();});
    peer.on('error',error=>{clearTimeout(timer);reject(Error(error.type==='peer-unavailable'?'그 코드의 방을 찾을 수 없어요.':'방에 연결하지 못했어요. 다시 시도해 주세요.'));});
   });
   if(generation!==this.generation){peer.destroy();return;}
   peer.on('error',()=>this.fail('연결에 문제가 생겼어요. 방을 다시 만들어 주세요.'));
   peer.on('disconnected',()=>{if(!this.ready)this.fail('방 서버와 연결이 끊겼어요. 다시 시도해 주세요.');});
   if(this.host){peer.on('connection',connection=>this.accept(connection));this.statusChanged('waiting');}
   else this.attach(peer.connect(PREFIX+this.code,{reliable:true,serialization:'json'}));
   this.timer=setInterval(()=>{
    if(this.ready){if(Date.now()-this.lastSeen>15000){this.fail('친구와 연결이 끊겼어요. 혼자 플레이로 돌아갑니다.');return;}this.send({type:'ping'});}
    else if(this.guest&&Date.now()-this.started>18000)this.fail('방이 응답하지 않아요. 코드를 확인하고 다시 시도해 주세요.');
   },1000);this.started=Date.now();
  }catch(error){if(generation===this.generation){this.leave();this.statusChanged('error',error.message);}throw error;}
 }
 accept(connection){
  if(this.connection){connection.on('open',()=>{connection.send({type:'full'});setTimeout(()=>connection.close(),300);});return;}
  this.attach(connection);
 }
 attach(connection){
  this.connection=connection;this.lastSeen=Date.now();
  const reservation=setTimeout(()=>{if(this.connection===connection&&!this.ready){connection.close();this.dropped();}},15000);
  connection.on('open',()=>{if(this.guest)this.send({type:'hello',save:this.hooks.save?.()});});
  connection.on('data',message=>{
   if(this.connection!==connection||!message||typeof message!=='object')return;
   this.lastSeen=Date.now();
   if(message.type==='full'){this.fail('이 방은 이미 2명이에요. 다른 방을 만들어 주세요.');return;}
   if(message.type==='bye'){this.dropped();return;}
   if(message.type==='hello'&&this.host&&!this.ready){this.ready=true;clearTimeout(reservation);this.hooks.join?.(message.save);this.statusChanged('connected');this.send({type:'welcome'});return;}
   if(message.type==='welcome'&&this.guest){this.ready=true;clearTimeout(reservation);this.statusChanged('connected');return;}
   if(this.ready&&message.type!=='ping')this.hooks.message?.(message);
  });
  connection.on('close',()=>{clearTimeout(reservation);if(this.connection===connection)this.dropped();});
  connection.on('error',()=>{clearTimeout(reservation);if(this.connection===connection)this.dropped();});
 }
 send(message){if(this.connection?.open){try{this.connection.send(message);}catch{this.dropped();}}}
 dropped(){const connection=this.connection;this.connection=null;this.ready=false;connection?.close();this.hooks.depart?.();if(this.host)this.statusChanged('waiting','친구가 나갔어요. 새 친구가 같은 코드로 들어올 수 있어요.');else this.fail('방장과 연결이 끊겼어요. 혼자 플레이로 돌아갑니다.');}
 fail(message){this.leave();this.statusChanged('error',message);}
 leave(){this.generation++;clearInterval(this.timer);const peer=this.peer,connection=this.connection;this.send({type:'bye'});this.peer=null;this.connection=null;this.ready=false;const wasActive=this.active;this.role='';this.code='';connection?.close();peer?.destroy();if(wasActive)this.hooks.depart?.();this.statusChanged('offline');}
}
