// 뿌요뿌요 배우기의 졸업 등급(졸업, 졸업2, 졸업3)에 쓰는 퍼즐 판.
// 빈 필드에서 거꾸로 4개씩 끼워 넣는 방법(역연쇄)으로 만들었고, 모든 판은 전소로 끝난다.
// chain: 몇 연쇄, pairs: 나오는 짝, answer: 놓을 자리 [줄(0~5), 돌림(0 세워서, 1 눕혀서 오른쪽으로)], field: 위에서 아래 줄 순서.
// 진짜 판(Player)으로 풀리는지는 upgrade4.test.mjs 가 확인한다. 판을 바꾸면 그 시험도 다시 돌린다.

// 한 수 퍼즐: 짝 하나를 놓으면 chain 연쇄. 졸업의 발화점 찾기 22판 (2연쇄부터 10연쇄까지)
export const FIND = [
  { chain: 2, pairs: [[1,1]], answer: [[2,1]],
    field: ['.G....','.G....','.R....','.GGR..'] },
  { chain: 2, pairs: [[3,3]], answer: [[3,1]],
    field: ['..G...','.GB...','GGB...'] },
  { chain: 3, pairs: [[3,3]], answer: [[3,0]],
    field: ['....Y.','....Y.','....GG','...BBG','...YGY'] },
  { chain: 3, pairs: [[1,1]], answer: [[0,0]],
    field: ['.YG...','.RYG..','RYYGG.'] },
  { chain: 3, pairs: [[2,2]], answer: [[0,0]],
    field: ['.Y....','.B....','.BY...','.GY...','GBBY..'] },
  { chain: 4, pairs: [[4,4]], answer: [[3,0]],
    field: ['....RG','....RB','....GR','....GR','....GB','....YB','....YB'] },
  { chain: 4, pairs: [[3,3]], answer: [[4,0]],
    field: ['...R..','..BG..','..BG..','..BG..','.BRB..','.RRG.B'] },
  { chain: 4, pairs: [[1,1]], answer: [[4,0]],
    field: ['...R..','...B..','...Y..','..RY..','..RY..','..BR..','..BY..','..RBR.'] },
  { chain: 5, pairs: [[4,4]], answer: [[4,0]],
    field: ['.G....','.G....','.GY...','.YR...','.YBB..','GRBY..','RRYB.Y'] },
  { chain: 5, pairs: [[1,1]], answer: [[3,0]],
    field: ['....R.','....G.','....G.','..B.R.','..BYR.','..YYG.','..BRG.','..BYRR'] },
  { chain: 5, pairs: [[2,2]], answer: [[3,0]],
    field: ['.G....','.GR...','BGR...','BRY...','BYG...','GYG...','BRY...'] },
  { chain: 6, pairs: [[2,2]], answer: [[4,1]],
    field: ['.G....','.R....','.YG...','YGR...','RBR...','YBGR..','YRBG..','BRRG..'] },
  { chain: 6, pairs: [[3,3]], answer: [[4,1]],
    field: ['.B....','.B....','.PP...','RPB...','RYB...','YRPG..','YRGB..','YGGB..'] },
  { chain: 6, pairs: [[3,3]], answer: [[4,0]],
    field: ['.B....','.P.Y..','.PRY..','.PRP..','.RBP..','.RYB..','.PYP..','.BBPB.'] },
  { chain: 7, pairs: [[1,1]], answer: [[5,0]],
    field: ['P.....','P.....','PB....','RB....','RB....','RP....','PRG...','PPG...','GGP.P.','PBPPRR'] },
  { chain: 7, pairs: [[1,1]], answer: [[3,0]],
    field: ['BP....','BBG...','RYG...','RYB...','YPP...','YBG...','RBG...','RBR...','BPR...'] },
  { chain: 8, pairs: [[1,1]], answer: [[4,0]],
    field: ['RY....','RP....','GBB...','GRR...','GPY...','YYBG..','GYBG..','YPYR..','YPGG.R'] },
  { chain: 8, pairs: [[3,3]], answer: [[5,0]],
    field: ['.P....','.P.G..','.P.G..','.B.G..','.Y.R..','.YPR..','.YGRY.','.PPYY.','.YPRB.','PBBBYB'] },
  { chain: 9, pairs: [[5,5]], answer: [[4,0]],
    field: ['B.....','RGP...','RGP...','PGRP..','GBYR..','PBYB..','PRBPP.','PBYBR.','RPYBR.'] },
  { chain: 9, pairs: [[1,1]], answer: [[1,0]],
    field: ['...Y..','...Y..','...RGP','..BYGP','..YRYP','..YGYB','..YRYB','..RBGB','..YBYY','.RBRPB'] },
  { chain: 10, pairs: [[5,5]], answer: [[0,0]],
    field: ['...PY.','...PYP','..GPBR','..PGGR','..GYBG','..GYBG','..BRPG','..BRPR','..RBPR','.PPBRB'] },
  { chain: 10, pairs: [[3,3]], answer: [[4,0]],
    field: ['.....R','..R..B','..R..B','.YPG.R','.YPG.R','.GPY.R','.YGB.B','GYPY.R','GRYRRB','GRYGRB'] },
];

// 졸업3의 어려운 발화점 찾기 6판 (9~12연쇄)
export const FIND_HARD = [
  { chain: 9, pairs: [[2,2]], answer: [[2,0]],
    field: ['G.....','GB....','GR.P..','YB.Y..','YB.B..','BR.G..','BR.B..','YRGB..','BBPB..','YPPY..','GBYY..'] },
  { chain: 10, pairs: [[2,2]], answer: [[3,0]],
    field: ['....R.','.BB.B.','.PP.P.','.PRGG.','.BRYP.','.GRYP.','.RPBP.','.GBPBP','.GYRBR','.GYPPR'] },
  { chain: 10, pairs: [[4,4]], answer: [[5,0]],
    field: ['G.....','G.....','P.....','R.....','RGBY..','RGBGG.','GPYRP.','GPYRP.','RPYPY.','GBGRY.','GBGRP.'] },
  { chain: 11, pairs: [[1,1]], answer: [[3,0]],
    field: ['....PR','....PP','....RG','....RP','.R..PB','.P..GP','PBY.GP','YBR.GP','YYRGRB','PBGRGB','PBRRGB'] },
  { chain: 11, pairs: [[2,2]], answer: [[0,0]],
    field: ['...BG.','...GP.','...YR.','..PYR.','..PYGP','..PGBP','..BGBR','.RBRGR','.GRGRP','.RBPRR','GRBYBG'] },
  { chain: 12, pairs: [[5,5]], answer: [[0,0]],
    field: ['...P..','...G..','.G.P.R','.GRBRY','.GRBGP','.BRBYP','.BYRGG','.BYBGP','.PYPYP','.PBRGY','GYPRGG'] },
];

// 졸업3의 대연쇄 3판 (11, 12, 13연쇄)
export const MEGA = [
  { chain: 11, pairs: [[4,4]], answer: [[4,0]],
    field: ['Y.....','Y....P','Y....B','PR...R','PB...R','PBR..Y','BGR..R','BYG.YR','PGYRRB','RYRPPB','YYGRPB'] },
  { chain: 12, pairs: [[1,1]], answer: [[4,0]],
    field: ['R....G','P..Y.Y','PY.B.P','GY.B.P','GPPG.P','GPGP.R','PRGP.P','GBBPRY','PRYGGY','PRGPGY'] },
  { chain: 13, pairs: [[3,3]], answer: [[1,0]],
    field: ['.....Y','...RGB','..YRBB','..BPRY','.PBYRY','.BYYBY','.YPRBG','.PBRBG','PRRBGY','PYYPBB','PYBYYY'] },
];

// 두 수 퍼즐: 첫 짝으로 모자란 곳을 채우고 둘째 짝으로 발화한다. 졸업2의 9판 (4~8연쇄)
export const TWO = [
  { chain: 4, pairs: [[3,3],[4,4]], answer: [[3,0],[4,0]],
    field: ['...B..','...G..','...G..','..YG..','..BY..','YYYGY.'] },
  { chain: 4, pairs: [[3,3],[1,1]], answer: [[2,0],[5,0]],
    field: ['.GB.Y.','.BGGR.','.GYYYR'] },
  { chain: 5, pairs: [[4,4],[4,4]], answer: [[3,0],[5,0]],
    field: ['....G.','....G.','..R.Y.','..R.B.','..RBY.','..YGB.','..RGBY'] },
  { chain: 5, pairs: [[3,3],[3,3]], answer: [[5,0],[3,0]],
    field: ['....G.','....Y.','....YR','....BY','....BR','....YR','...GBR','...GGB'] },
  { chain: 6, pairs: [[1,1],[4,4]], answer: [[2,0],[0,0]],
    field: ['...GP.','...GP.','...YG.','...RY.','.B.YY.','.YBBP.','YBRGP.'] },
  { chain: 6, pairs: [[2,2],[2,2]], answer: [[2,0],[1,0]],
    field: ['....Y.','....Y.','....Y.','..G.R.','..B.R.','..BPR.','..BGP.','..GPR.','G.BPY.'] },
  { chain: 7, pairs: [[3,3],[1,1]], answer: [[2,0],[4,0]],
    field: ['.G....','.G.P..','.G.P..','.YBP..','.YRY..','.YRY..','.BRY..','.YPR..','.GRY.R'] },
  { chain: 7, pairs: [[3,3],[2,2]], answer: [[0,0],[3,0]],
    field: ['.RP...','YBY...','YBY...','BRY...','BBR...','YRY...','YGG...','BPPP..'] },
  { chain: 8, pairs: [[3,3],[2,2]], answer: [[1,0],[5,0]],
    field: ['Y.....','Y.Y...','Y.Y...','GBY...','GRB...','GRB...','BRB.R.','GYRRG.','YRBRG.'] },
];

// 졸업3의 두 수 퍼즐 4판 (5~8연쇄, 안내 없이)
export const TWO_HARD = [
  { chain: 5, pairs: [[2,2],[5,5]], answer: [[4,0],[3,0]],
    field: ['.....P','.....P','.....P','....RY','....RY','....RY','....PG','....RY','...PGP'] },
  { chain: 6, pairs: [[3,3],[1,1]], answer: [[2,0],[0,0]],
    field: ['.G.R..','.Y.R..','.Y.Y..','.YBY..','.RGY..','.RGBR.','.YGYR.'] },
  { chain: 7, pairs: [[5,5],[5,5]], answer: [[4,0],[1,0]],
    field: ['.....G','.....G','...B.G','...G.Y','...G.Y','...GPY','..RRBP','..PRBY','.PRGBG'] },
  { chain: 8, pairs: [[3,3],[5,5]], answer: [[0,0],[5,0]],
    field: ['..R...','.YR...','.YGPB.','.BGBY.','.YGBY.','.YPYP.','.RPYP.','BRGPB.'] },
];
