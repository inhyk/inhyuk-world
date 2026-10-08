// 뿌요뿌요 배우기의 졸업3(늘린 부분), 졸업4, 졸업5 에 쓰는 퍼즐 판 122개.
// 인혁이 기획서 「뿌요뿌요 (업그레이드)」 2번 "졸업3은 엄청 길게, 졸업4랑 졸업5도 만드는데 그것도 엄청 길게" (2026-10-08).
// school-puzzles.mjs 와 같은 방법(빈 필드에서 거꾸로 4개씩 끼워 넣는 역연쇄)으로 만들었고, 모든 판은 전소로 끝난다.
// chain: 몇 연쇄, pairs: 나오는 짝 [먼저 색, 다음 색], field: 위에서 아래 줄 순서 (O 는 방해 뿌요).
// answer: 놓을 자리 [줄(0~5), 돌림]. 돌림 0 세워서(먼저 색이 아래), 1 눕혀서(먼저 색이 왼쪽, 오른쪽 줄까지),
//         2 뒤집어 세워서(먼저 색이 위), 3 눕혀서(먼저 색이 오른쪽, 왼쪽 줄까지).
// 진짜 판(Player)으로 풀리는지는 tutorial.test.mjs 와 upgrade4.test.mjs 가 확인한다. 판을 바꾸면 그 시험도 다시 돌린다.

// 졸업3 · 눕혀서 발화 8판 (4~11연쇄): 같은 색 짝을 눕혀야만 풀린다
export const FLAT3 = [
  { chain: 4, pairs: [[4,4]], answer: [[4,1]],
    field: ['..Y...','.BYG..','BYGY..','BBYGGY'] },
  { chain: 5, pairs: [[3,3]], answer: [[1,1]],
    field: ['...R..','...Y..','...GB.','...GBB','...GYR','...BRR','.BYGYB'] },
  { chain: 6, pairs: [[2,2]], answer: [[3,1]],
    field: ['..R...','..G...','.YB...','.YGGR.','.BBYY.','.BYRRY','.GYGGY'] },
  { chain: 7, pairs: [[5,5]], answer: [[0,1]],
    field: ['..G...','..GR..','..GR..','..BBP.','..BGYY','..YBRY','..PRYP','PYYYPP'] },
  { chain: 8, pairs: [[3,3]], answer: [[2,1]],
    field: ['....G.','....YB','....GR','....BG','..BRPG','..RGRG','..YYPR','.RGBBR','RYGPBP'] },
  { chain: 9, pairs: [[5,5]], answer: [[4,1]],
    field: ['G.....','Y.....','BYB...','BRG...','BGP...','GBP...','PPG...','GRR...','GGRG..','YBYP..','BBGGGP'] },
  { chain: 10, pairs: [[2,2]], answer: [[1,1]],
    field: ['...R..','...RY.','...PB.','...PYG','...RGB','...BGB','Y..RYB','R..BRG','G..BRR','RRGBPP','RYYYRY'] },
  { chain: 11, pairs: [[3,3]], answer: [[3,1]],
    field: ['.P....','PG....','YPG...','RRP...','YYP...','PPB...','RYYRB.','PRGBR.','PPYGR.','GGPPBB','GYYGBR'] },
];

// 졸업3 · 두 색 발화 8판 (4~11연쇄): 한 뿌요는 발화점에, 다른 뿌요는 뒤쪽 연쇄의 빈칸에
export const DUO3 = [
  { chain: 4, pairs: [[3,2]], answer: [[3,1]],
    field: ['..Y...','..RB..','..BR..','..BY..','..RYG.','.YRGG.'] },
  { chain: 5, pairs: [[4,1]], answer: [[0,1]],
    field: ['.R....','.G....','YY....','BY....','GG....','GY....','BB....','BYR...','YYR...'] },
  { chain: 6, pairs: [[4,3]], answer: [[4,0]],
    field: ['..G...','..YG.B','..YG.Y','..GY.Y','..GRRB','..YGGR','..YGRB'] },
  { chain: 7, pairs: [[4,3]], answer: [[1,1]],
    field: ['...G..','...YR.','...YP.','...GY.','...BY.','..PBB.','.YYRP.','PPRPP.','PYGRG.'] },
  { chain: 8, pairs: [[1,3]], answer: [[5,0]],
    field: ['..Y...','..GB..','..BR..','..BR..','.RGB..','.PGBG.','.GRYB.','PYGGRR','PPGYRB'] },
  { chain: 9, pairs: [[3,2]], answer: [[2,0]],
    field: ['...B..','...G..','...G..','...Y.Y','...GBY','...RYB','.R.PPG','.B.BGR','.BYYRR','.RRYGP','.RYGBP'] },
  { chain: 10, pairs: [[4,2]], answer: [[4,0]],
    field: ['.P....','YYP...','GGR...','BYP...','YBP...','YRGR..','BRYR..','RGBP.G','RPPRYY','YPYGGY'] },
  { chain: 11, pairs: [[3,2]], answer: [[1,0]],
    field: ['...GB.','...BR.','...PB.','..GRYG','..BBYP','..GYBB','..YGGG','..YYBP','..RRGP','BBBGGP','GPPPYY'] },
];

// 졸업3 · 세 수 퍼즐 6판 (5~10연쇄, 자리를 알려 줌): 앞의 두 짝으로 채우고 셋째 짝으로 발화
export const THREE3 = [
  { chain: 5, pairs: [[4,4],[1,1],[2,2]], answer: [[2,0],[2,1],[0,0]],
    field: ['.R....','.Y....','.B....','.B.G..','.GBY..','.GBG..','.RGG..'] },
  { chain: 6, pairs: [[4,4],[2,2],[3,3]], answer: [[3,1],[2,1],[5,0]],
    field: ['....G.','..B.R.','..Y.G.','..YGG.','..BRB.','..BBG.','..GRRB'] },
  { chain: 7, pairs: [[4,4],[2,2],[2,2]], answer: [[1,1],[2,0],[3,0]],
    field: ['.R....','.R....','.R....','BBY...','GGR...','YPB...','YGG...','PPB...','YPYY..'] },
  { chain: 8, pairs: [[1,1],[4,4],[2,2]], answer: [[3,1],[1,1],[1,0]],
    field: ['..RBG.','..BBYR','..RGGY','G.GPBY','Y.RGPY','Y.RRPP'] },
  { chain: 9, pairs: [[5,5],[5,5],[3,3]], answer: [[2,1],[0,1],[4,0]],
    field: ['.Y....','BGY...','YBY...','RPG...','RBB...','PRYR..','PYYR..','PRRB..','RYGG.B'] },
  { chain: 10, pairs: [[1,1],[3,3],[2,2]], answer: [[3,0],[4,1],[2,0]],
    field: ['....B.','....G.','....BY','....PY','.R.GGP','GGPYPY','GPGGPY','PGRBGB','PYYBYB'] },
];

// 졸업3 · 방해 뿌요 속 발화점 7판 (4~10연쇄). garbage: 같이 사라지는 방해 뿌요 수
export const DIG3 = [
  { chain: 4, pairs: [[2,2]], answer: [[1,0]], garbage: 3,
    field: ['...O..','...OO.','..BYG.','..BBY.','..GYG.','G.BYGG'] },
  { chain: 5, pairs: [[1,1]], answer: [[4,0]], garbage: 2,
    field: ['.ORO..','.RGY..','.RYG..','.GBG..','RYRR..','BBBY..'] },
  { chain: 6, pairs: [[1,1]], answer: [[0,0]], garbage: 4,
    field: ['...O..','.O.Y..','.BBY..','.GYB..','.RYRBB','GRBORO','GGBBRR'] },
  { chain: 7, pairs: [[3,3]], answer: [[3,0]], garbage: 2,
    field: ['.B....','OYB...','YBY...','BRY...','RPR...','RPP...','POG...','GGY...','YYB...','GYB...'] },
  { chain: 8, pairs: [[1,1]], answer: [[5,0]], garbage: 3,
    field: ['..Y...','..P...','..OR..','.ORR..','OYPPB.','BBRPG.','BYYGR.','PPBPG.','BPBBGR'] },
  { chain: 9, pairs: [[1,1]], answer: [[2,0]], garbage: 3,
    field: ['RR.O..','GP.BO.','GP.GP.','GO.GP.','YG.YGY','RR.YGP','YYYBYP','PPRRBB'] },
  { chain: 10, pairs: [[4,4]], answer: [[4,0]], garbage: 2,
    field: ['.B....','BR....','GPPO..','PGBP..','RYOY..','RPPY..','RPYP..','PRGY..','PPRY..','RRGB..','BBPBB.'] },
];

// 졸업3 · 초대연쇄 14연쇄
export const MEGA3 = [
  { chain: 14, pairs: [[2,2]], answer: [[3,0]],
    field: ['Y....G','P...BP','Y.Y.PB','GPY.GB','GPY.RB','PYB.GG','PPBBPB','RRPYPP','BBBRRR','GRRBPG','GPYPPG'] },
];

// 졸업4 · 발화점 찾기 10판 (8~13연쇄)
export const FIND4 = [
  { chain: 8, pairs: [[5,5]], answer: [[3,0]],
    field: ['.Y....','.RP...','.RB...','GPY...','PRR...','PGP...','RRPB..','PRYB..','RGGY..','PPBP..'] },
  { chain: 9, pairs: [[3,3]], answer: [[5,0]],
    field: ['.G....','.BG...','.BY.R.','.RB.G.','.RR.P.','.YP.Y.','.PRRB.','.PBRBY','.PRGPY','.YYPPY'] },
  { chain: 9, pairs: [[1,1]], answer: [[1,0]],
    field: ['...B..','..YB..','..BYR.','..BRG.','..GRY.','B.GRG.','P.YGP.','R.GPG.','RBBGP.','PPPBP.'] },
  { chain: 10, pairs: [[1,1]], answer: [[4,0]],
    field: ['.B....','.B....','GPG...','YYPR..','PYBR..','PBBG..','BYPB..','PGPB..','GRRB..','GBPR..','BGGB.R'] },
  { chain: 10, pairs: [[1,1]], answer: [[0,0]],
    field: ['....B.','....R.','...GR.','...RG.','...BGB','...PGY','..BGPG','.RRBBB','.GYPRG','YYGYYG','GYBPYG'] },
  { chain: 11, pairs: [[4,4]], answer: [[2,0]],
    field: ['...GGR','...BPR','...BPY','...BRP','...PYP','...PBY','.R.PRY','.P.YGB','PR.BYY','PY.PBY','PYRRBG'] },
  { chain: 11, pairs: [[1,1]], answer: [[5,0]],
    field: ['.B....','.P....','.GP...','.BPR..','.YBB..','.GGBY.','RGPGB.','BYYGB.','GPYPRR','GPPYBB','BRRBYY'] },
  { chain: 12, pairs: [[4,4]], answer: [[0,0]],
    field: ['...RG.','...RB.','...YR.','..YRYG','..RPYR','.BYYRG','.PBRRP','.GBYPP','.YGRBB','PYGBRR','PPGYGB'] },
  { chain: 12, pairs: [[2,2]], answer: [[3,0]],
    field: ['Y.....','PY..R.','YPP.Y.','RYP.R.','YRY.G.','YYRBG.','GRPRR.','YPPRY.','YGGYY.','BBBRR.','YYGPR.'] },
  { chain: 13, pairs: [[5,5]], answer: [[3,0]],
    field: ['....BP','....BP','..R.GB','..G.PP','.RYYYB','.YBPRB','YGBRPB','RGYYPG','RRPYRR','BBPBGR','RGPRGB'] },
];

// 졸업4 · 눕혀서 발화 6판 (7~12연쇄)
export const FLAT4 = [
  { chain: 7, pairs: [[1,1]], answer: [[3,1]],
    field: ['.P....','PP....','YGR...','YYB...','RRG...','YRP...','PBP...','BGR...','BPPGR.'] },
  { chain: 8, pairs: [[2,2]], answer: [[0,1]],
    field: ['..B.R.','..B.P.','..RBRY','..GRYP','..PGYP','..RPGP','..GRRR','GBPPGY'] },
  { chain: 9, pairs: [[3,3]], answer: [[2,1]],
    field: ['.G....','YG....','RG....','RR....','YB..R.','PB..P.','PB..P.','BR..G.','PY..B.','PYBRGG','GRRPGP'] },
  { chain: 10, pairs: [[2,2]], answer: [[4,1]],
    field: ['BP....','BG....','PGB...','PBR...','PYR...','BPB...','RGYB..','RRYP..','PPPR..','RGYG..','PPPRBG'] },
  { chain: 11, pairs: [[1,1]], answer: [[1,1]],
    field: ['...B..','...GB.','...RY.','...RRG','R..PPB','Y..BBP','G..YBP','R..YRB','GYRYBG','GGYPGP','YRRRPP'] },
  { chain: 12, pairs: [[4,4]], answer: [[0,1]],
    field: ['...GBB','...GRR','..PPRY','..RBYY','..GYBB','..RYBP','..RYGP','..GRRG','..YGPP','YPGRBY','PRRYRB'] },
];

// 졸업4 · 혼자 푸는 두 수 퍼즐 10판 (6~11연쇄, 첫 짝이 두 색일 때도 있다)
export const TWO4 = [
  { chain: 6, pairs: [[4,4],[2,2]], answer: [[3,1],[5,0]],
    field: ['...B..','..GR..','..BR..','.YYY..','.BRG..','.BRYG.','.GGYGY'] },
  { chain: 7, pairs: [[2,2],[4,4]], answer: [[1,1],[3,0]],
    field: ['PRB...','PRG...','PYR...','RBR...','BBR...','YRY...','YPY...','YRG...'] },
  { chain: 7, pairs: [[2,3],[2,2]], answer: [[4,1],[1,0]],
    field: ['...G..','...Y..','..GGB.','..YPY.','..YRR.','..GGRY','..PRPY','.YPBYB'] },
  { chain: 8, pairs: [[4,4],[1,1]], answer: [[1,1],[4,0]],
    field: ['B..Y..','BY.P..','GRBY..','GRYR..','BBYR..','GGBY.P','BBRRPP'] },
  { chain: 8, pairs: [[2,3],[5,5]], answer: [[2,1],[2,0]],
    field: ['....P.','...RG.','...RG.','...GR.','...GYP','...PPY','.G.RBY','.YGYBY','GYYPBP'] },
  { chain: 9, pairs: [[5,1],[5,5]], answer: [[1,0],[5,0]],
    field: ['....B.','..RYY.','..PRR.','..YYB.','.PGPG.','.RYRG.','.GRRP.','.YYGPB','.GGYGB'] },
  { chain: 9, pairs: [[4,3],[1,1]], answer: [[1,1],[0,0]],
    field: ['...R..','...YY.','...BR.','..BGR.','..RPP.','..YRR.','..BBB.','.BYRP.','.RRPGG','YYYGBR'] },
  { chain: 10, pairs: [[5,2],[2,2]], answer: [[4,0],[3,0]],
    field: ['....GB','..BBGY','..RBPP','..RPYP','..RPGY','..YGPY','..YRGB','.GGGBB','.BYYPG'] },
  { chain: 10, pairs: [[4,1],[5,5]], answer: [[3,0],[1,0]],
    field: ['....R.','....R.','...GYG','...GYB','...RBP','..RBGP','..GBGP','..GGBB','..PRGB','..PRBP','.GGRGY'] },
  { chain: 11, pairs: [[1,4],[3,3]], answer: [[3,0],[0,0]],
    field: ['..BRY.','..GRB.','..GBY.','..GPGG','.RYGRG','.YYBGY','.BRBBY','BYRPPY','YYRPBB'] },
];

// 졸업4 · 두 색 발화 6판 (8~13연쇄)
export const DUO4 = [
  { chain: 8, pairs: [[2,5]], answer: [[1,0]],
    field: ['..R...','..R.R.','..PGR.','..BGB.','..GRB.','B.RYB.','P.GGG.','PBYYY.','RRBGB.'] },
  { chain: 9, pairs: [[3,2]], answer: [[5,0]],
    field: ['.GY...','.GR...','.GBG..','.BGYG.','.RBRP.','.GYPP.','.YPRYB','.YBGGB','.YGYGB'] },
  { chain: 10, pairs: [[4,1]], answer: [[2,0]],
    field: ['...YR.','...YR.','...YP.','...GP.','...GBP','.P.BYR','.Y.YBR','.Y.BYY','.RYGYB','.RPPGP','.RPBBB'] },
  { chain: 11, pairs: [[1,5]], answer: [[4,0]],
    field: ['..P..Y','..G..R','.GGY.P','.PRGRR','.PYYPR','BRYGBP','RBGPRR','RBGYYR','BGBBBY'] },
  { chain: 12, pairs: [[3,4]], answer: [[1,1]],
    field: ['P.....','Y..B..','Y..RR.','Y..YG.','G..YBR','G.PPBG','G.RBYG','B.RPPB','BBRYBR','GPPRYB','YPYYGB'] },
  { chain: 13, pairs: [[5,1]], answer: [[3,0]],
    field: ['.R....','.B....','GBR...','RRB.YR','BGB.YB','BGY.PB','RRYBPP','GPPBYY','RRRYRB','YYPRRB','RRPYYY'] },
];

// 졸업4 · 혼자 푸는 세 수 퍼즐 6판 (6~11연쇄)
export const THREE4 = [
  { chain: 6, pairs: [[2,2],[4,2],[3,3]], answer: [[0,1],[2,0],[3,0]],
    field: ['.B....','.BB...','.YY...','BRR...','RYB...','YYB...','GRYY..'] },
  { chain: 7, pairs: [[2,3],[5,4],[5,5]], answer: [[2,1],[2,1],[1,0]],
    field: ['....B.','....Y.','..RPB.','..RGY.','..PRPB','.PRGGB','.BBPYB'] },
  { chain: 8, pairs: [[4,4],[3,3],[1,1]], answer: [[2,0],[2,1],[4,0]],
    field: ['.B....','.R.P..','.G.B..','.G.R..','.BBR..','.BGPG.','.GRRR.','.YBGG.','.YPPG.'] },
  { chain: 9, pairs: [[5,3],[3,3],[3,3]], answer: [[3,1],[3,0],[2,0]],
    field: ['.R....','.Y....','.P....','.P..Y.','.B..Y.','.P.GY.','.PBGP.','.YYPP.','.YRRR.','.PBPG.','.PPYG.'] },
  { chain: 10, pairs: [[1,1],[1,3],[4,4]], answer: [[0,1],[2,1],[5,0]],
    field: ['....R.','..R.R.','..BRG.','..YBG.','.YRGB.','PYBPB.','PPRRY.','RRPPB.','YPGPBY'] },
  { chain: 11, pairs: [[3,3],[4,2],[1,1]], answer: [[0,1],[4,0],[0,0]],
    field: ['..YY..','..BBGG','..BRBY','..GYRR','..GPRB','.GPRPB','.GPRRG','.RRYYR','.PPYPP'] },
];

// 졸업4 · 방해 뿌요 속 발화점 6판 (7~12연쇄)
export const DIG4 = [
  { chain: 7, pairs: [[1,1]], answer: [[3,0]], garbage: 4,
    field: ['..B...','..R...','..P.O.','.OP.P.','.BO.G.','OYY.G.','YRR.GP','RYP.PG','RRPBBP'] },
  { chain: 8, pairs: [[2,2]], answer: [[5,0]], garbage: 4,
    field: ['...OO.','..BBY.','..POY.','..RRB.','.OPBR.','.PYGB.','.GYBG.','.YBBGR','PYGGYY'] },
  { chain: 9, pairs: [[5,5]], answer: [[2,0]], garbage: 6,
    field: ['...R..','...P..','...RO.','...PR.','.OBPG.','.OBRY.','.YBRR.','.YYPP.','OOPYPO','PPYGYY','PBRRGG'] },
  { chain: 10, pairs: [[2,2]], answer: [[4,0]], garbage: 2,
    field: ['.....R','.....B','..Y..B','..YO.Y','..YG.G','.ORY.Y','.BRYBY','.BGYPY','.BYGRB','.YGGRR','BRRPPP'] },
  { chain: 11, pairs: [[4,4]], answer: [[1,0]], garbage: 5,
    field: ['...OB.','...BP.','O..RP.','Y..GY.','Y..GR.','R.OGRO','Y.GYYB','YBGYGY','RBOPYR','RYBGGY','RYBPBY'] },
  { chain: 12, pairs: [[3,3]], answer: [[4,0]], garbage: 4,
    field: ['.....R','.B...Y','.BB..O','.GRO.G','OGRB.P','YGYY.B','YYBYGP','BOGPGP','RRPYGP','BYPRRY','BBPRYY'] },
];

// 졸업4 · 초대연쇄 14, 15연쇄
export const MEGA4 = [
  { chain: 14, pairs: [[3,3]], answer: [[2,0]],
    field: ['....PB','.R.BRP','.B.PBR','.B.BGP','RP.PRY','BR.BRP','RPPBPR','PRGYRG','PGRRGG','PGGYYP','RBRRPP'] },
  { chain: 15, pairs: [[1,1]], answer: [[3,0]],
    field: ['YB..Y.','RY..G.','BPP.YP','RRP.RP','YBBYRY','YBRYGB','GPBPGG','GYBYRB','YBGYPB','YGPRPB','YPPYRR'] },
];

// 졸업5 · 발화점 찾기 10판 (10~15연쇄)
export const FIND5 = [
  { chain: 10, pairs: [[5,5]], answer: [[0,0]],
    field: ['...GP.','...PR.','...PG.','...BRP','..BBYY','..YPPG','.RYRPG','.RGYGP','.RBGGY','PPRYRY'] },
  { chain: 11, pairs: [[5,5]], answer: [[2,0]],
    field: ['PG....','BP....','BY....','BY.YP.','RB.GP.','RPPGY.','BBGPP.','BYPRGY','RPYRGY','RBGGRR'] },
  { chain: 12, pairs: [[1,1]], answer: [[5,0]],
    field: ['.Y....','.YYBB.','.PGBR.','PRGYR.','PRYGR.','BPPBB.','RGPBR.','RPGRB.','BGBGGR','BBPYYY'] },
  { chain: 12, pairs: [[1,1]], answer: [[0,0]],
    field: ['...BP.','...PY.','..RPB.','.GRBR.','.BRYBR','.BYPPR','.BYBPR','.GBGYG','.GGBGG','.RYBYP','.RYRBP'] },
  { chain: 13, pairs: [[2,2]], answer: [[2,0]],
    field: ['.Y.G..','.R.P..','.R.PG.','GY.YP.','RP.PR.','RR.GRG','GPPGYG','YRBPGR','YRBYGP','PRPYRG','PGGBBG'] },
  { chain: 13, pairs: [[3,3]], answer: [[3,0]],
    field: ['.B..Y.','BY..P.','GG..P.','GBG.Y.','RPB.Y.','RPY.GP','GBB.RP','BPYPRG','BPYPRY','RRGRPG','GGBBPG'] },
  { chain: 14, pairs: [[5,5]], answer: [[1,0]],
    field: ['...BBG','P..YPP','B..GYR','B..PYB','B.PBGB','G.BGPR','P.BPBY','PGGPGB','GYBPGG','BPYGBR','PPYYBR'] },
  { chain: 14, pairs: [[4,4]], answer: [[2,0]],
    field: ['.G.PP.','YP.BG.','PY.BR.','PG.GRG','PG.PYB','YG.RYB','BP.RBR','YY.RBY','BGRGYR','BBPPBB','YPGGPG'] },
  { chain: 15, pairs: [[3,3]], answer: [[1,0]],
    field: ['...PGB','Y..YRG','B.BYPB','G.RRBG','B.YGBP','BRGGBP','GYBYYY','GRBRPP','GBRBYG','YBRYBG','YBPBBP'] },
  { chain: 15, pairs: [[4,4]], answer: [[3,0]],
    field: ['.B..RR','GG..BB','RBG.GY','YRG.GY','BYR.RB','GRRYYB','GYYRRB','GRRYRY','PPRYGY','PYYRBB','GPBRBG'] },
];

// 졸업5 · 뒤집어서 두 색 발화 8판 (8~14연쇄): 나온 그대로는 색이 반대라 뒤집거나(돌림 2) 반대로 눕혀야(돌림 3) 한다
export const DUO5 = [
  { chain: 8, pairs: [[2,5]], answer: [[0,2]],
    field: ['.YR...','.BB...','.YBR..','.GRR..','.YBBB.','PPYGR.','GPRGG.','GRRBBG'] },
  { chain: 9, pairs: [[1,2]], answer: [[4,3]],
    field: ['.G....','.G....','.GYY..','.RRB..','.YGB..','.BRY..','.BRY..','.YGY..','YBGR..','YGBYR.','YBYBR.'] },
  { chain: 10, pairs: [[2,4]], answer: [[1,3]],
    field: ['...Y..','...B..','.Y.B..','.Y.BY.','.PBGY.','.PYRY.','.BYGG.','.BGPR.','.BGYR.','.YYGYG','YBPYYR'] },
  { chain: 11, pairs: [[2,1]], answer: [[5,3]],
    field: ['P.....','RP....','RGP...','GRP...','PRYB..','BGYB..','BGGB..','GBYRY.','BPBYG.','PGGRG.','PYYYGR'] },
  { chain: 12, pairs: [[4,3]], answer: [[2,3]],
    field: ['P...P.','G.Y.B.','BBYBY.','BYPBBG','GRBRPB','GBRPPB','GPGGBP','RPPYYP','BBBYGP'] },
  { chain: 12, pairs: [[2,1]], answer: [[4,2]],
    field: ['BR....','YB....','RGG...','GRPP..','GRRG..','YYPB..','YBPB..','BRRG.R','RBYBGR','GGGBGR','BBBYYY'] },
  { chain: 13, pairs: [[2,3]], answer: [[1,3]],
    field: ['...BB.','...RB.','..GBP.','..RGPY','.PRPYG','.BRBRG','.GBYYG','BBYRPP','PBRYPG','PGPYYP','GGRGPB'] },
  { chain: 14, pairs: [[1,3]], answer: [[3,3]],
    field: ['....Y.','....RG','...BRB','GPRBRG','GBRYYY','BGYRBG','BGGRBG','YPYPRG','PYPRGB','PGPRGB','GGPRGB'] },
];

// 졸업5 · 두 수 퍼즐 8판 (8~12연쇄, 첫 짝이 항상 두 색)
export const TWO5 = [
  { chain: 8, pairs: [[3,5],[2,2]], answer: [[3,0],[1,0]],
    field: ['..P...','G.B...','P.B...','Y.Y...','G.RP..','GPRY..','YPBR..','YYGRY.','PGGPY.'] },
  { chain: 9, pairs: [[5,4],[5,5]], answer: [[3,0],[4,0]],
    field: ['.P....','.YY...','.YR...','PBR...','GYPR..','RRYY..','YYBB..','RRYY..','GGBR..','GYPP..'] },
  { chain: 10, pairs: [[1,4],[4,4]], answer: [[4,0],[2,1]],
    field: ['.....Y','.....R','.....G','....RP','....YR','..YBBR','.RPBYP','.RPGPP','.GGPRG','.GRBGG','.RPRRY'] },
  { chain: 10, pairs: [[2,4],[5,5]], answer: [[3,1],[5,0]],
    field: ['YY....','GYB...','GBY...','GRR...','BGR...','YBP...','YPB...','PBBGP.','BGGRP.','YYPYYY'] },
  { chain: 11, pairs: [[1,5],[4,4]], answer: [[4,0],[0,0]],
    field: ['.....P','.....G','..R..G','..R.GR','..B.GB','.YB.RG','.YYRBG','.RBYBB','.RGBPR','.YRGPG','YRGGRG'] },
  { chain: 11, pairs: [[2,3],[1,1]], answer: [[2,0],[3,1]],
    field: ['.B....','.B...B','.G...Y','.BB..G','.YBYRR','.BYBBG','.GYPRG','.RGBRG','RPRBRY','RPPRYY'] },
  { chain: 12, pairs: [[2,5],[2,2]], answer: [[3,0],[1,0]],
    field: ['....PR','....RR','..GRGG','..GPPY','..GRBY','..RRGG','..PPGP','.GGRPP','.RPRYY','.PPGBG','.RRBBG'] },
  { chain: 12, pairs: [[2,4],[4,4]], answer: [[3,1],[0,0]],
    field: ['.PGGB.','.PBYRY','.PGPRY','.BGYPB','.GYPYY','.GBGYP','.GPGRB','.YGYBR','.YBYGY'] },
];

// 졸업5 · 혼자 푸는 세 수 퍼즐 8판 (8~12연쇄)
export const THREE5 = [
  { chain: 8, pairs: [[4,1],[5,1],[3,3]], answer: [[2,0],[1,0],[4,0]],
    field: ['...Y..','..PY..','R.BP..','G.YB..','GGYR..','BBRB..','YYRR..','RGPYB.'] },
  { chain: 9, pairs: [[5,4],[2,2],[2,2]], answer: [[3,0],[0,1],[2,0]],
    field: ['.Y....','.R.BP.','PG.BP.','PGRPY.','YYRRP.','PBBPPY','PYGGYP'] },
  { chain: 9, pairs: [[5,1],[5,5],[4,4]], answer: [[5,0],[3,1],[5,0]],
    field: ['RR....','GG....','GPB...','BPY...','GYG...','GGY.R.','PYB.Y.','PBR.Y.','RGPRR.'] },
  { chain: 10, pairs: [[5,2],[2,3],[5,5]], answer: [[3,0],[4,1],[0,0]],
    field: ['.PG...','.BG.B.','.RP.YG','.BB.YB','.BP.BY','.YR.BY','.PR.GG','.YR.BB','PYY.GB'] },
  { chain: 10, pairs: [[5,3],[2,1],[5,5]], answer: [[0,1],[3,0],[3,0]],
    field: ['..G...','.BG.P.','.GB.R.','.RB.PB','.RG.PY','.RP.RR','.PRPBY','.PGBYY','.GGPPB'] },
  { chain: 11, pairs: [[2,1],[5,3],[2,2]], answer: [[0,0],[3,0],[1,0]],
    field: ['..P.B.','..Y.P.','..BGBG','..GYGG','.BGYYR','.RYPGG','.YRYRR','.YGRGR','GGBBGB'] },
  { chain: 11, pairs: [[3,5],[5,5],[2,2]], answer: [[0,0],[3,0],[0,0]],
    field: ['....Y.','....P.','...RG.','.G.GG.','.P.PB.','.P.RP.','.B.RPY','.GRPRR','.GRBBP','.BGRBG','GBPGYY'] },
  { chain: 12, pairs: [[5,5],[3,5],[4,4]], answer: [[2,0],[3,1],[5,0]],
    field: ['.P....','RG.R..','RYGRP.','BGRPY.','YGGPY.','BYYRG.','BGRPBB','BGRGGB','RRGRRG'] },
];

// 졸업5 · 네 수 퍼즐 4판 (6~9연쇄, 자리를 알려 줌)
export const FOUR5 = [
  { chain: 6, pairs: [[4,2],[1,2],[4,2],[1,1]], answer: [[1,0],[3,0],[0,1],[5,0]],
    field: ['..G...','..G...','..R...','..G...','..RGB.','.BBBR.','.YYRGR'] },
  { chain: 7, pairs: [[1,2],[1,2],[1,2],[5,5]], answer: [[2,0],[0,1],[1,1],[3,0]],
    field: ['.Y....','BY....','GR....','BB....','YPP...','YPR...','RRP...','BPRP..'] },
  { chain: 8, pairs: [[3,5],[3,3],[5,5],[2,2]], answer: [[2,0],[3,0],[5,0],[1,0]],
    field: ['....B.','...RP.','...GG.','..RRP.','..RPG.','..YBBB','..GYYY','G.PBGP'] },
  { chain: 9, pairs: [[2,5],[2,5],[3,1],[2,2]], answer: [[0,0],[1,0],[3,0],[4,0]],
    field: ['..G...','.PR...','YGB...','RGB...','RBG...','RYGR..','BBBR..','RYYG..','GBPG..'] },
];

// 졸업5 · 방해 뿌요 속 발화점 6판 (9~14연쇄)
export const DIG5 = [
  { chain: 9, pairs: [[5,5]], answer: [[4,0]], garbage: 3,
    field: ['.B....','BR....','BPB...','PRB...','POG...','GBP...','PGGO..','OPBG..','PRGY..','PRGP..','BGYPYY'] },
  { chain: 10, pairs: [[1,1]], answer: [[0,0]], garbage: 5,
    field: ['....B.','....R.','..R.R.','..R.R.','.OOOPO','.GPYPP','.RPBGO','.YPRYY','.YGPYB','RRGBGG','YYGRPG'] },
  { chain: 11, pairs: [[3,3]], answer: [[3,0]], garbage: 3,
    field: ['....YO','....PY','.OG.PG','.GR.YG','.OR.YR','.RY.BR','.PYGBR','.YGBYY','.YBBPP','.PPYYR','.RPBGG'] },
  { chain: 12, pairs: [[5,5]], answer: [[5,0]], garbage: 5,
    field: ['.P....','OP....','PBYOO.','GYPGG.','GYYGP.','BPGBY.','GROBB.','PBRYP.','RBRBPY','POPBBY','GBBPPP'] },
  { chain: 13, pairs: [[4,4]], answer: [[1,0]], garbage: 7,
    field: ['R.....','G..OOO','B.GOPP','B.GBGP','YYGBYG','BGBOBG','BPGPBO','GGYYBP','GRBGGG','RPOBPP','RPPGYP'] },
  { chain: 14, pairs: [[5,5]], answer: [[2,0]], garbage: 3,
    field: ['YR.RPP','RG.RPB','RR.PYP','OY.OBY','BG.YYG','BG.BPG','GP.PPR','BP.RGO','BG.YRY','RYGGYY','YGRBRG'] },
];

// 졸업5 · 초대연쇄 15, 16연쇄
export const MEGA5 = [
  { chain: 15, pairs: [[3,3]], answer: [[3,0]],
    field: ['.R..RB','RB..BP','BBP.PB','GYP.BP','GYP.PP','BYRBYB','YRRPYB','BGPRRP','GBYYBP','BBRPBP','RPRPRB'] },
  { chain: 16, pairs: [[2,2]], answer: [[2,0]],
    field: ['GY..RR','YB.PPB','YR.RBP','BPGGRP','BGYRGR','YYPRGR','RYPPRG','RGGBRB','PGBRBB','RPPRGP','YGGGBB'] },
];
