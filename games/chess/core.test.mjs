import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../../public/play/chess/vendor/chess.mjs';
import { evaluate,rankMoves,reviewMove,grade,winningChance } from '../../public/play/chess/engine.mjs';

test('initial position has 20 legal moves; illegal moves do not change the board',()=>{
 const g=new Chess(),fen=g.fen();assert.equal(g.moves().length,20);assert.throws(()=>g.move({from:'e2',to:'e5'}));assert.equal(g.fen(),fen);
});
test('a pinned rook cannot expose its king',()=>{
 const g=new Chess('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1');assert.ok(!g.moves({square:'e2',verbose:true}).some(m=>m.to==='d2'));
});
test('castling moves king and rook together and rejects castling through check',()=>{
 const g=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');g.move('O-O');assert.equal(g.get('g1').type,'k');assert.equal(g.get('f1').type,'r');
 const blocked=new Chess('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1');assert.ok(!blocked.moves().includes('O-O'));
});
test('en passant captures the pawn on the passed square',()=>{
 const g=new Chess();for(const m of ['e4','a6','e5','d5','exd6'])g.move(m);assert.equal(g.get('d5'),undefined);assert.equal(g.get('d6').color,'w');
});
test('promotion includes all four choices',()=>{
 const g=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');assert.equal(g.moves({square:'a7',verbose:true}).filter(m=>m.to==='a8').length,4);g.move({from:'a7',to:'a8',promotion:'n'});assert.equal(g.get('a8').type,'n');
});
test('Fool’s mate and stalemate finish the game correctly',()=>{
 const g=new Chess();for(const m of ['f3','e5','g4','Qh4#'])g.move(m);assert.ok(g.isCheckmate());assert.equal(evaluate(g),-30000);assert.ok(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').isStalemate());
});
test('threefold repetition produces a draw',()=>{
 const g=new Chess();for(const m of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8'])g.move(m);assert.ok(g.isThreefoldRepetition());assert.equal(evaluate(g),0);
});
test('engine finds a forced mate for black; review uses white evaluation sign',()=>{
 const g=new Chess();for(const m of ['f3','e5','g4'])g.move(m);const fen=g.fen(),ranked=rankMoves(fen,2);assert.equal(ranked[0].san,'Qh4#');assert.equal(g.fen(),fen);const r=reviewMove(fen,'Qh4#');assert.equal(r.kind,'best');assert.equal(r.loss,0);assert.equal(r.score,-30000);
});
test('review marks a move allowing mate as a blunder and recommends safety',()=>{
 const g=new Chess();for(const m of ['f3','e5'])g.move(m);const r=reviewMove(g.fen(),'g4');assert.equal(r.kind,'blunder');assert.notEqual(r.best,'g4');assert.ok(r.loss>230);
});
test('analysis finds a hanging queen and leaves position untouched',()=>{
 const g=new Chess('7k/8/8/8/8/8/q7/R6K w - - 0 1'),fen=g.fen();const best=rankMoves(fen,2)[0];assert.equal(best.san,'Rxa2');assert.equal(g.fen(),fen);
});
test('review labels follow loss boundaries',()=>{
 assert.equal(grade(0).kind,'best');assert.equal(grade(30).kind,'good');assert.equal(grade(100).kind,'inaccuracy');assert.equal(grade(200).kind,'mistake');assert.equal(grade(400).kind,'blunder');
});

test('a rook trade includes the recapture by the second rook',()=>{
 const g=new Chess('3r3k/8/8/3r4/8/8/3R4/3R3K w - - 0 1');
 const r=reviewMove(g.fen(),'Rxd5');assert.notEqual(r.kind,'blunder');assert.ok(r.loss<100,JSON.stringify(r));assert.ok(r.score>400,JSON.stringify(r));
});
test('ordinary development and castling are not blunders',()=>{
 const g=new Chess();for(const san of ['e4','e5','Nf3','Nc6','Bb5','a6','Bxc6','dxc6','O-O']){
 const r=reviewMove(g.fen(),san);assert.notEqual(r.kind,'blunder',san);g.move(san);
 }
});
test('large numerical swings in already decided positions are not blunders',()=>{
 const chanceLoss=winningChance(-1500)-winningChance(-2200);
 assert.equal(grade(700,chanceLoss).kind,'good');
 assert.equal(grade(450,winningChance(0)-winningChance(-450)).kind,'blunder');
 assert.notEqual(grade(300,0.5).kind,'blunder');
});
