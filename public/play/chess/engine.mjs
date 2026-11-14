import { Chess } from './vendor/chess.mjs';
export const values = { p:100, n:320, b:335, r:500, q:900, k:0 };
export function evaluate(game) {
  if (game.isCheckmate()) return game.turn()==='w' ? -30000 : 30000;
  if (game.isDraw()) return 0;
  let score=0;
  const board=game.board();
  for (let r=0;r<8;r++) for(let c=0;c<8;c++) {
    const p=board[r][c]; if(!p)continue;
    const advance=p.color==='w'?6-r:r-1;
    const center=7-Math.abs(3.5-r)-Math.abs(3.5-c);
    const bonus=p.type==='p'?advance*9+center*3:p.type==='n'||p.type==='b'?center*10:p.type==='k'?-center*3:center*2;
    score+=(p.color==='w'?1:-1)*(values[p.type]+bonus);
  }
  return score;
}
function quiescence(game, alpha, beta, remaining=4) {
  const score=evaluate(game)*(game.turn()==='w'?1:-1);
  if(remaining===0||game.isGameOver())return score;
  const inCheck=game.isCheck();
  if(!inCheck){if(score>=beta)return score;alpha=Math.max(alpha,score);}
  const moves=game.moves({verbose:true})
    .filter(m=>inCheck||m.captured||m.promotion)
    .sort((a,b)=>(values[b.captured]||0)-(values[a.captured]||0));
  let best=inCheck?-Infinity:score;
  for(const move of moves){
    game.move(move);const next=-quiescence(game,-beta,-alpha,remaining-1);game.undo();
    best=Math.max(best,next);alpha=Math.max(alpha,next);if(alpha>=beta)break;
  }
  return best;
}
function search(game, depth, alpha, beta, stabilize) {
  if(game.isGameOver())return evaluate(game)*(game.turn()==='w'?1:-1);
  if(depth===0)return stabilize?quiescence(game,alpha,beta):evaluate(game)*(game.turn()==='w'?1:-1);
  let best=-Infinity;
  const moves=game.moves({verbose:true}).sort((a,b)=>(values[b.captured]||0)-(values[a.captured]||0));
  for(const move of moves) {
    game.move(move); const score=-search(game,depth-1,-beta,-alpha,stabilize); game.undo();
    best=Math.max(best,score); alpha=Math.max(alpha,score); if(alpha>=beta)break;
  }
  return best;
}
export function rankMoves(fen,depth=2,stabilize=false) {
  const game=new Chess(fen);
  return game.moves({verbose:true}).map(move=>{
    game.move(move);const score=-search(game,depth-1,-Infinity,Infinity,stabilize);game.undo();
    return {from:move.from,to:move.to,promotion:move.promotion,san:move.san,score};
  }).sort((a,b)=>b.score-a.score);
}
export function winningChance(score) {
  return 1/(1+Math.exp(-Math.max(-3000,Math.min(3000,score))/400));
}
export function grade(loss, chanceLoss=1) {
  if(loss<30)return {label:'최선',kind:'best',icon:'★'};
  if(loss<100||chanceLoss<0.04)return {label:'좋은 수',kind:'good',icon:'✓'};
  if(loss<200||chanceLoss<0.08)return {label:'부정확',kind:'inaccuracy',icon:'?!'};
  if(loss<400||chanceLoss<0.18)return {label:'실수',kind:'mistake',icon:'?'};
  return {label:'큰 실수',kind:'blunder',icon:'??'};
}
export function reviewMove(fen,san) {
  const ranked=rankMoves(fen,2,true),best=ranked[0],played=ranked.find(m=>m.san===san);
  if(!played||!best)throw new Error('분석할 수를 찾을 수 없습니다.');
  const loss=Math.max(0,best.score-played.score);
  const chanceLoss=Math.max(0,winningChance(best.score)-winningChance(played.score));
  return {san,best:best.san,bestFrom:best.from,bestTo:best.to,loss,chanceLoss,score:played.score*(new Chess(fen).turn()==='w'?1:-1),...grade(loss,chanceLoss)};
}
