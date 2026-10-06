import test from 'node:test';
import assert from 'node:assert/strict';
import { ValleyRoom,serverUrl,safeMove,NET_GAME } from './room.mjs';
import { DEFAULT_SERVER } from '../../packages/net/index.mjs';

// net 서버 흉내를 내는 가짜 WebSocket
class FakeSocket{
 constructor(url){this.url=url;this.readyState=1;this.sent=[];this.listeners={};}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 send(text){this.sent.push(JSON.parse(text));}
 close(){this.readyState=3;}
 serve(message){for(const fn of this.listeners.message??[])fn({data:JSON.stringify(message)});}
 drop(){this.readyState=3;for(const fn of this.listeners.close??[])fn({code:1006});}
}
function setup(){
 const log={status:[],join:0,depart:0,message:[],sockets:[],fetch:[]};
 const room=new ValleyRoom({
  status:(s,m)=>log.status.push([s,m]),join:()=>log.join++,depart:()=>log.depart++,message:m=>log.message.push(m),
 },{
  server:'ws://local.test',
  fetch:async(url,init)=>{log.fetch.push([url,JSON.parse(init.body)]);return {ok:true,json:async()=>({code:'ABCDEF',maxPlayers:2})};},
  connect:url=>{const s=new FakeSocket(url);log.sockets.push(s);return s;},
 });
 return {room,log};
}
const tick=()=>new Promise(r=>setTimeout(r,0));

test('serverUrl: 기본은 진짜 서버, ?net= 은 내 컴퓨터 주소만',()=>{
 assert.equal(serverUrl(''),DEFAULT_SERVER);
 assert.equal(serverUrl('?net=http://127.0.0.1:8787'),'http://127.0.0.1:8787');
 assert.equal(serverUrl('?net=ws://localhost:9000/'),'ws://localhost:9000');
 assert.equal(serverUrl('?net=https://evil.example'),DEFAULT_SERVER);
 assert.equal(serverUrl('',{VITE_NET_SERVER:'ws://x.test/'}),'ws://x.test');
});

test('safeMove 는 친구 조작을 걸러 쓴다',()=>{
 assert.deepEqual(safeMove({mx:5,mz:-1,yaw:99}),{mx:0,mz:-1,yaw:9});
 assert.deepEqual(safeMove(null),{mx:0,mz:0,yaw:0});
});

test('방장: 방을 만들고 친구를 기다리다 친구가 오고 나간다',async()=>{
 const {room,log}=setup();
 const opening=room.open();await tick();
 assert.deepEqual(log.fetch,[[`http://local.test/rooms/${NET_GAME}`,{maxPlayers:2}]]);
 const s=log.sockets[0];assert.equal(s.url,`ws://local.test/rooms/${NET_GAME}/ABCDEF`);
 s.serve({t:'welcome',id:'p1',host:'p1',max:2,peers:[]});await opening;
 assert.equal(room.host,true);assert.equal(room.code,'ABCDEF');assert.equal(room.status,'waiting');assert.equal(room.ready,false);
 assert.equal(room.send({type:'f'}),false,'친구가 없으면 보내지 않는다');
 s.serve({t:'join',id:'p2'});
 assert.equal(room.ready,true);assert.equal(room.status,'connected');assert.equal(log.join,1);
 room.send({type:'f',t:1});
 assert.deepEqual(s.sent.at(-1),{t:'send',data:{type:'f',t:1}});
 s.serve({t:'msg',from:'p2',data:{type:'i',mx:1}});
 s.serve({t:'msg',from:'p9',data:{type:'i',mx:1}}); // 모르는 사람 것은 무시
 assert.deepEqual(log.message,[{type:'i',mx:1}]);
 s.serve({t:'leave',id:'p2'});
 assert.equal(room.ready,false);assert.equal(room.active,true);assert.equal(log.depart,1);
 assert.deepEqual(log.status.at(-1),['waiting','친구가 나갔어요. 새 친구가 같은 코드로 들어올 수 있어요.']);
 // 새 친구가 같은 코드로 들어온다
 s.serve({t:'join',id:'p3'});assert.equal(room.ready,true);assert.equal(log.join,2);
 room.leave();
 assert.equal(room.active,false);assert.equal(room.status,'offline');
 assert.deepEqual(s.sent.at(-1),{t:'bye'});
});

test('손님: 코드로 들어가고, 방장이 나가면 혼자 플레이로 돌아간다',async()=>{
 const {room,log}=setup();
 const opening=room.open('abc-def');await tick();
 const s=log.sockets[0];assert.equal(s.url,`ws://local.test/rooms/${NET_GAME}/ABCDEF`);
 s.serve({t:'welcome',id:'p2',host:'p1',max:2,peers:['p1']});await opening;
 assert.equal(room.guest,true);assert.equal(room.ready,true);assert.equal(room.status,'connected');
 assert.equal(log.join,0,'join 훅은 방장 쪽에서만');
 s.serve({t:'leave',id:'p1'});
 s.serve({t:'host',id:'p2'}); // 서버는 손님을 방장으로 올리지만 이미 나왔다
 assert.equal(room.active,false);assert.ok(log.depart>=1);
 assert.deepEqual(log.status.at(-1),['error','방장과 연결이 끊겼어요. 혼자 플레이로 돌아갑니다.']);
 assert.deepEqual(s.sent.at(-1),{t:'bye'});
});

test('꽉 찬 방, 없는 방, 끊긴 연결은 게임 말투로 알린다',async()=>{
 {const {room,log}=setup();const opening=room.open('ABCDEF');await tick();
  log.sockets[0].serve({t:'error',code:'full',max:2});
  await assert.rejects(opening,/이미 2명이에요/);
  assert.equal(room.active,false);assert.deepEqual(log.status.at(-1),['error','이 방은 이미 2명이에요. 다른 방을 만들어 주세요.']);}
 {const {room,log}=setup();const opening=room.open('ABCDEF');await tick();
  log.sockets[0].serve({t:'error',code:'not-found'});
  await assert.rejects(opening,/찾을 수 없어요/);assert.equal(room.active,false);}
 {const {room,log}=setup();await assert.rejects(room.open('AB'),/여섯 글자/);assert.equal(room.active,false);assert.equal(log.status.at(-1)[0],'error');}
 {const {room,log}=setup();const opening=room.open('ABCDEF');await tick();
  const s=log.sockets[0];s.serve({t:'welcome',id:'p2',host:'p1',max:2,peers:['p1']});await opening;
  const departs=log.depart;s.drop();
  assert.equal(room.active,false);assert.equal(log.depart,departs+1);
  assert.deepEqual(log.status.at(-1),['error','방 서버와 연결이 끊겼어요. 혼자 플레이로 돌아갑니다.']);}
});
