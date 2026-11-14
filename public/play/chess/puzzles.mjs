import { Chess } from './vendor/chess.mjs';

// Original teaching positions. Every line is checked by puzzles.test.mjs.
export const puzzles = [
  {id:'back-rank',title:'닫힌 뒷줄',theme:'메이트',level:'입문',fen:'6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1',line:['Re8#'],goal:'mate',hint:'상대 폰이 왕의 퇴로를 막고 있어요. 룩을 마지막 줄로 보내세요.',explanation:'Re8#으로 8번째 줄을 모두 막아요. 왕은 자기 폰 때문에 앞으로도 도망갈 수 없어요.'},
  {id:'queen-support',title:'왕과 퀸의 팀워크',theme:'메이트',level:'입문',fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1',line:['Qg7#'],goal:'mate',hint:'우리 왕이 지켜 주는 칸으로 퀸을 옮겨 보세요.',explanation:'g7의 퀸은 f6의 왕이 지켜요. 상대 왕은 퀸을 잡을 수도, 피할 수도 없어요.'},
  {id:'pawn-takes-queen',title:'작은 폰의 큰 선물',theme:'기물 따내기',level:'입문',fen:'7k/8/8/3q4/4P3/8/8/7K w - - 0 1',line:['exd5'],goal:'line',hint:'폰은 앞으로만 가지만, 잡을 때는 대각선으로 움직여요.',explanation:'exd5! 폰으로 퀸을 잡았어요. 작은 기물도 상대의 큰 기물을 잡을 수 있어요.'},
  {id:'bishop-diagonal',title:'대각선의 보물',theme:'기물 따내기',level:'입문',fen:'6k1/8/8/6q1/8/4B3/8/6K1 w - - 0 1',line:['Bxg5'],goal:'line',hint:'비숍이 갈 수 있는 대각선을 끝까지 따라가 보세요.',explanation:'Bxg5로 방어받지 않는 퀸을 잡아요. 상대가 놓친 대각선을 살펴보세요.'},
  {id:'black-back-rank',title:'흑도 한 수 메이트',theme:'메이트',level:'쉬움',fen:'4r1k1/8/8/8/8/8/5PPP/6K1 b - - 0 1',line:['Re1#'],goal:'mate',hint:'이번에는 흑 차례! 룩으로 백의 첫 번째 줄을 공격하세요.',explanation:'Re1#으로 백 왕을 가둬요. 흑은 화면 아래쪽에서 시작하므로 방향도 잘 확인하세요.'},
  {id:'smothered',title:'나이트의 숨은 길',theme:'메이트',level:'쉬움',fen:'6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1',line:['Nf7#'],goal:'mate',hint:'기물을 뛰어넘을 수 있는 나이트로 체크하세요. 상대 왕 주위는 꽉 막혀 있어요.',explanation:'Nf7#은 질식 메이트예요. 왕이 자기 기물에 둘러싸여 나이트의 체크를 피하지 못해요.'},
  {id:'promotion',title:'폰의 졸업식',theme:'기물 따내기',level:'입문',fen:'8/P6k/8/8/8/8/8/7K w - - 0 1',line:['a8=Q'],goal:'line',hint:'폰을 마지막 줄에 보내고 퀸을 선택하세요.',explanation:'a8=Q! 마지막 줄에 도착한 폰은 퀸으로 승격할 수 있어요. 이제 퀸으로 승리를 노려 보세요.'},
  {id:'knight-fork',title:'왕과 룩, 한꺼번에',theme:'기물 따내기',level:'도전',fen:'1r1k4/8/8/4N3/8/8/8/6K1 w - - 0 1',line:['Nc6+','Kd7','Nxb8+'],goal:'line',hint:'나이트로 체크하면서 b8의 룩도 동시에 공격하는 칸을 찾으세요.',explanation:'Nc6+는 왕과 룩을 함께 공격하는 포크예요. 왕이 피한 뒤 Nxb8+로 룩을 따내요.'},
  {id:'queen-back-rank',title:'퀸이 막는 탈출로',theme:'메이트',level:'쉬움',fen:'6k1/5ppp/8/8/8/8/8/3Q2K1 w - - 0 1',line:['Qd8#'],goal:'mate',hint:'퀸도 룩처럼 직선으로 이동할 수 있어요. 8번째 줄을 지배하세요.',explanation:'Qd8#으로 왕이 있는 줄 전체를 공격해요. 다른 한 수 메이트를 찾아도 정답이에요.'},
  {id:'black-fork',title:'흑 나이트의 양수겸장',theme:'기물 따내기',level:'도전',fen:'6k1/8/8/8/4n3/8/8/1R1K4 b - - 0 1',line:['Nc3+','Kd2','Nxb1+'],goal:'line',hint:'체크와 함께 b1의 룩을 노려 보세요. 먼저 왕을 움직이게 만드는 거예요.',explanation:'Nc3+로 왕과 룩을 동시에 공격해요. 백 왕이 피하면 Nxb1+로 룩을 잡아요.'},
];

export class PuzzleSession {
  constructor(puzzle){this.puzzle=puzzle;this.game=new Chess(puzzle.fen);this.step=0;this.mistakes=0;this.hintLevel=0;this.solved=false;this.revealed=false;this.lastMove=null;}
  get expected(){return this.puzzle.line[this.step];}
  get player(){return this.puzzle.fen.split(' ')[1];}
  attempt(move){
    if(this.solved||this.revealed)return {kind:'locked'};
    let played;try{played=this.game.move(move);}catch{return {kind:'illegal'};}
    const correct=played.san===this.expected||(this.puzzle.goal==='mate'&&this.game.isCheckmate());
    if(!correct){this.game.undo();this.mistakes++;return {kind:'wrong'};}
    this.lastMove=played;this.step++;
    if(this.step>=this.puzzle.line.length||this.game.isCheckmate()){this.solved=true;return {kind:'solved'};}
    const reply=this.game.move(this.expected);this.step++;this.lastMove=reply;
    return {kind:'continue',reply:reply.san};
  }
  reveal(){
    if(this.solved)return;
    while(this.step<this.puzzle.line.length){this.lastMove=this.game.move(this.expected);this.step++;}
    this.revealed=true;
  }
}
