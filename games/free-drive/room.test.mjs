import test from 'node:test';
import assert from 'node:assert/strict';
import {DriveRoom,serverUrl,friendly,NET_GAME} from './room.mjs';
import {DEFAULT_SERVER} from '../../packages/net/index.mjs';
import {SEND_EVERY} from './online.mjs';

// net 서버를 흉내 내는 작은 중계기: 방 하나, 들어온 순서대로 p1, p2 ..., 방장이 나가면 다음 사람이 방장.
function relay(max=2){
 const room={code:'FREE22',max,host:'',next:1,members:[]};const urls=[];
 class Socket{
  constructor(url){this.url=url;this.readyState=1;this.listeners={};urls.push(url);setTimeout(()=>this.enter(),0);}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  emit(type,payload){for(const fn of this.listeners[type]??[])fn(payload);}
  serve(m){if(this.readyState===1)this.emit('message',{data:JSON.stringify(m)});}
  enter(){
   if(!this.url.endsWith('/'+room.code)){this.serve({t:'error',code:'not-found'});this.close();return;}
   if(room.members.length>=room.max){this.serve({t:'error',code:'full',max:room.max});this.close();return;}
   this.id=`p${room.next++}`;if(!room.host)room.host=this.id;
   const others=room.members.map(s=>s.id);room.members.push(this);
   this.serve({t:'welcome',id:this.id,host:room.host,max:room.max,peers:others});
   for(const s of room.members)if(s!==this)s.serve({t:'join',id:this.id});
  }
  send(text){const m=JSON.parse(text);if(m.t==='send')for(const s of room.members)if(s!==this&&(!m.to||m.to===s.id))s.serve({t:'msg',from:this.id,data:m.data});if(m.t==='bye')this.close();}
  close(){if(this.readyState!==1)return;this.readyState=3;const i=room.members.indexOf(this);if(i<0)return;room.members.splice(i,1);
   for(const s of room.members)s.serve({t:'leave',id:this.id});
   if(room.host===this.id){room.host=room.members[0]?.id||'';if(room.host)for(const s of room.members)s.serve({t:'host',id:room.host});}}
  drop(){this.close();}
 }
 const options={server:'ws://127.0.0.1:8787',fetch:async()=>({ok:true,json:async()=>({code:room.code,maxPlayers:max})}),connect:url=>new Socket(url)};
 return {room,urls,options};
}
function player(options,save={coins:1}){
 const log={status:[],join:[],depart:0,message:[]};
 const r=new DriveRoom({save:()=>save,status:(s,m)=>log.status.push([s,m]),join:raw=>log.join.push(raw),depart:()=>log.depart++,message:m=>log.message.push(m)},options);
 return {r,log};
}
const wait=(ms=5)=>new Promise(resolve=>setTimeout(resolve,ms));

test('server url defaults to production and only accepts loopback overrides',()=>{
 assert.equal(serverUrl(''),DEFAULT_SERVER);
 assert.equal(serverUrl('?net=http://127.0.0.1:8787/'),'http://127.0.0.1:8787');
 assert.equal(serverUrl('?net=ws://localhost:9000'),'ws://localhost:9000');
 assert.equal(serverUrl('?net=https://evil.example'),DEFAULT_SERVER);
 assert.equal(serverUrl('',{VITE_NET_SERVER:'ws://192.168.0.5:8787/'}),'ws://192.168.0.5:8787');
 assert.equal(NET_GAME,'free-drive');
});
test('server messages are shown in the game polite tone',()=>{
 assert.equal(friendly('그 코드의 방을 찾을 수 없어.'),'그 코드의 방을 찾을 수 없어요.');
 assert.equal(friendly('이 방은 벌써 2명이야. 다른 방을 만들어 줘.'),'이 방은 이미 2명이에요. 다른 방을 만들어 주세요.');
});
test('position updates stay well under the 30 messages per second server limit',()=>{
 assert.ok(1/SEND_EVERY<=20);
});
test('host creates a code room, guest joins with hello/welcome, messages go both ways',async()=>{
 const {urls,options}=relay();const host=player(options),guest=player(options,{coins:300});
 await host.r.open();assert.equal(host.r.code,'FREE22');assert.equal(host.r.status,'waiting');assert.ok(host.r.host);
 assert.equal(urls[0],'ws://127.0.0.1:8787/rooms/free-drive/FREE22');
 await guest.r.open('free22');await wait();
 assert.deepEqual(host.log.join,[{coins:300}]);assert.equal(host.r.status,'connected');assert.equal(guest.r.status,'connected');assert.ok(guest.r.ready&&host.r.ready);
 assert.equal(guest.r.send({type:'input',input:{gas:true},actions:[['repair']]}),true);host.r.send({type:'frame',notices:['+5 코인']});
 await wait();
 assert.deepEqual(host.log.message,[{type:'input',input:{gas:true},actions:[['repair']]}]);assert.deepEqual(guest.log.message,[{type:'frame',notices:['+5 코인']}]);
 assert.equal(host.r.rate().total,2);// welcome + frame
 assert.equal(guest.r.rate().peak,2);// hello + input
 host.r.leave();guest.r.leave();
});
test('third player is told the room is full; missing code is reported',async()=>{
 const {options}=relay();const host=player(options),guest=player(options),third=player(options),lost=player(options);
 await host.r.open();await guest.r.open('FREE22');await wait();
 await third.r.open('FREE22');assert.equal(third.r.status,'error');assert.equal(third.r.active,false);assert.match(third.log.status.at(-1)[1],/이미 2명/);
 await lost.r.open('ZZZZZZ');assert.match(lost.log.status.at(-1)[1],/찾을 수 없어요/);
 await lost.r.open('AB');assert.match(lost.log.status.at(-1)[1],/여섯 글자/);assert.equal(lost.r.active,false);
 assert.equal(host.r.status,'connected');host.r.leave();guest.r.leave();
});
test('guest leaving frees the slot; host leaving sends the guest back to solo play',async()=>{
 const {options}=relay();const host=player(options),guest=player(options),next=player(options);
 await host.r.open();await guest.r.open('FREE22');await wait();
 guest.r.leave();await wait();
 assert.equal(host.r.status,'waiting');assert.equal(host.log.depart,1);assert.equal(host.r.ready,false);assert.match(host.log.status.at(-1)[1],/친구가 나갔어요/);
 await next.r.open('FREE22');await wait();assert.equal(host.r.status,'connected');assert.equal(host.log.join.length,2);
 host.r.leave();await wait();
 assert.equal(next.r.active,false);assert.equal(next.r.status,'error');assert.match(next.log.status.at(-1)[1],/방장과 연결이 끊겼어요/);assert.equal(next.log.depart,1);
 assert.equal(next.r.send({type:'input'}),false);
});
