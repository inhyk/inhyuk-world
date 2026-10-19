import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Account, memoryStorage } from '../../public/play/pixelcraft/net-client/index.mjs';

test('static shared account client stays identical to its canonical source', async () => {
  for (const name of ['index.mjs', 'social.mjs']) assert.equal(await readFile(new URL(`../../public/play/pixelcraft/net-client/${name}`,import.meta.url),'utf8'),await readFile(new URL(`../../packages/net/${name}`,import.meta.url),'utf8'));
});
test('shared accounts store sessions, restore nickname, and invalidate tokens on logout', async () => {
  const calls=[];
  const storage=memoryStorage();
  const client=new Account({storage,server:'http://127.0.0.1:8789',fetch:async(url,options)=>{
    calls.push({url,options});
    return Response.json(url.endsWith('/auth/logout')?{ok:true}:url.endsWith('/me')?{user:{id:'a1',nickname:'여행자'}}:{token:'test-only',user:{id:'a1',nickname:'여행자'}});
  }});
  await client.signup('여행자','abcd');assert.equal(client.loggedIn,true);
  const restored=new Account({storage});assert.equal(restored.user.nickname,'여행자');
  await client.me();assert.equal(calls.at(-1).options.headers.Authorization,'Bearer test-only');
  await client.logout();assert.equal(client.loggedIn,false);assert.equal(new Account({storage}).loggedIn,false);
});
