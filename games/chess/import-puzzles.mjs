import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {Chess} from '../../public/play/chess/vendor/chess.mjs';
const input=process.argv[2];
if(!input){throw Error('Pass the Lichess .csv.zst archive path as the first argument.');}
const out=fileURLToPath(new URL('../../public/play/chess/data/',import.meta.url));
const shardSize=1000, ratingBands=Array.from({length:13},(_,i)=>[500+i*200,700+i*200]);
const candidateBands=ratingBands.map(()=>[]);let serial=0;
const proc=spawn('zstd',['-dc',input],{stdio:['ignore','pipe','inherit']});
const lines=createInterface({input:proc.stdout,crlfDelay:Infinity});let n=0,invalid=0;
for await(const line of lines){
 if(!n++){continue;}const c=line.split(',');if(c.length<9)continue;
 const [id,fen,moves,rating,popularity,plays,themes,url]=[c[0],c[1],c[2],Number(c[3]),Number(c[5]),Number(c[6]),c[7],c[8]];
 if(!id||!fen||!moves||popularity<60||plays<25||rating<500||rating>=3100)continue;
 const band=Math.min(12,Math.floor((rating-500)/200)),pool=candidateBands[band];
 const item={id,fen,moves,rating,themes,url,priority:(popularity*1000+Math.min(plays,1000))};
 if(pool.length<10000)pool.push(item);else {const j=serial%(pool.length+1);if(j<pool.length)pool[j]=item;}serial++;
 if(candidateBands.reduce((sum,a)=>sum+a.length,0)>=120000)break;
 if(n%500000===0)process.stderr.write(`Scanned ${n}, accepted ${candidateBands.map(a=>a.length).join('/')}\n`);
}
const [code]=await new Promise(resolve=>proc.on('close',c=>resolve([c])));
if(code!==0)throw Error(`zstd failed with ${code}`);
const flat=[];for(let round=0;flat.length<100000;round++){let available=false;for(const band of candidateBands){const p=band[round];if(!p)continue;available=true;try{const g=new Chess(p.fen);for(const m of p.moves.split(' '))g.move({from:m.slice(0,2),to:m.slice(2,4),...(m[4]?{promotion:m[4]}:{})});flat.push(p);}catch{invalid++;}if(flat.length===100000)break;}if(!available)break;}
if(flat.length<100000)throw Error(`Archive yielded only ${flat.length} legal puzzles. Band counts: ${candidateBands.map(a=>a.length).join(',')}`);
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
const chosen=flat.sort((a,b)=>a.rating-b.rating||a.id.localeCompare(b.id));
for(let i=0;i<chosen.length;i+=shardSize){
 const shard=chosen.slice(i,i+shardSize).map(p=>[p.id,p.fen,p.moves,p.rating,p.themes,p.url]);
 await fs.writeFile(`${out}/${String(i/shardSize).padStart(3,'0')}.json`,JSON.stringify(shard));
}
const manifest={source:'Lichess puzzle database · CC0 · https://database.lichess.org/#puzzles',count:chosen.length,shardSize,shardCount:chosen.length/shardSize,ratingBands:ratingBands.map(([min,max])=>({min,max,count:chosen.filter(p=>p.rating>=min&&p.rating<max).length})),counts:{mate:chosen.filter(p=>p.themes.split(' ').some(t=>t.startsWith('mate'))).length,fork:chosen.filter(p=>p.themes.includes('fork')).length}};
await fs.writeFile(`${out}/manifest.json`,JSON.stringify(manifest));
process.stderr.write(`Built ${chosen.length}; rejected ${invalid} illegal lines; themes ${JSON.stringify(manifest.counts)}\n`);
