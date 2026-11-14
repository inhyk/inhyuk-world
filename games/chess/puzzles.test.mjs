import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../../public/play/chess/vendor/chess.mjs';
import {puzzles,PuzzleSession} from '../../public/play/chess/puzzles.mjs';

test('all puzzle lines are legal, start with the player, and meet their goal',()=>{
 assert.equal(new Set(puzzles.map(p=>p.id)).size,puzzles.length);
 for(const p of puzzles){const g=new Chess(p.fen);assert.equal(g.isGameOver(),false,p.id);assert.ok(p.line.length%2===1,p.id);for(const san of p.line)g.move(san);if(p.goal==='mate')assert.ok(g.isCheckmate(),p.id);}
});
test('all scripted solutions complete including automatic opponent replies',()=>{
 for(const p of puzzles){const s=new PuzzleSession(p);let result;while(!s.solved){result=s.attempt(s.expected);assert.ok(['continue','solved'].includes(result.kind),p.id);}assert.equal(result.kind,'solved');assert.equal(s.step,p.line.length);assert.equal(s.game.history().length,p.line.length);}
});
test('wrong and illegal attempts leave position and puzzle step unchanged',()=>{
 const s=new PuzzleSession(puzzles[0]),fen=s.game.fen();assert.equal(s.attempt('Re2').kind,'wrong');assert.equal(s.game.fen(),fen);assert.equal(s.step,0);assert.equal(s.mistakes,1);assert.equal(s.attempt({from:'e1',to:'f3'}).kind,'illegal');assert.equal(s.game.fen(),fen);assert.equal(s.mistakes,1);
});
test('any alternative immediate mate is accepted',()=>{
 const p={...puzzles[1],fen:'7k/5Q1p/5K2/8/8/8/8/8 w - - 0 1'},g=new Chess(p.fen);const alternatives=g.moves().filter(san=>san.endsWith('#')&&san!==p.line[0]);assert.ok(alternatives.length);assert.equal(new PuzzleSession(p).attempt(alternatives[0]).kind,'solved');
});
test('forks require the follow-up capture, and wrong continuation can be retried',()=>{
 for(const id of ['knight-fork','black-fork']){const s=new PuzzleSession(puzzles.find(p=>p.id===id));assert.equal(s.attempt(s.expected).kind,'continue');assert.equal(s.step,2);const fen=s.game.fen();const wrong=s.game.moves().find(m=>m!==s.expected);assert.equal(s.attempt(wrong).kind,'wrong');assert.equal(s.game.fen(),fen);assert.equal(s.attempt(s.expected).kind,'solved');}
});
test('promotion requires the selected queen and permits retry after underpromotion',()=>{
 const s=new PuzzleSession(puzzles.find(p=>p.id==='promotion'));assert.equal(s.attempt({from:'a7',to:'a8',promotion:'n'}).kind,'wrong');assert.equal(s.game.get('a7').type,'p');assert.equal(s.attempt({from:'a7',to:'a8',promotion:'q'}).kind,'solved');
});
test('revealing a solution never counts as solving and locks further input',()=>{
 for(const p of puzzles){const s=new PuzzleSession(p);s.reveal();assert.equal(s.revealed,true);assert.equal(s.solved,false);assert.equal(s.step,p.line.length);assert.equal(s.attempt(p.line[0]).kind,'locked');}
});
