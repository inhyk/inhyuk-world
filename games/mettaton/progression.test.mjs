import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, start, choose, strike } from '../../public/play/mettaton/core.mjs';
import { createProgress, recordVictory, neoUnlocked, canStartChallenge } from '../../public/play/mettaton/progression.mjs';
function victory(difficulty, ending='fight') {
  const s=createState(difficulty);start(s);s.mode='menu';
  if(ending==='fight'){s.bossHp=1;choose(s,'fight');strike(s);}
  else {s.ratings=s.ratingGoal;choose(s,'mercy');}
  assert.equal(s.mode,'won');return s;
}
test('NEO starts locked and cannot be selected by a new player',()=>{
  const p=createProgress();assert.equal(neoUnlocked(p),false);assert.equal(canStartChallenge(p,'neo'),false);
  for(const mode of ['easy','normal','hard'])assert.equal(canStartChallenge(p,mode),true);
  assert.equal(canStartChallenge(p,'invalid'),false);
});
for(const difficulty of ['easy','normal'])for(const ending of ['fight','audience'])test(`${difficulty} ${ending} victory does not unlock NEO`,()=>{
  const p=createProgress();assert.equal(recordVictory(p,victory(difficulty,ending)),false);
  assert.equal(p.clears[difficulty],true);assert.equal(neoUnlocked(p),false);assert.equal(canStartChallenge(p,'neo'),false);
});
for(const ending of ['fight','audience'])test(`Encore ${ending} victory unlocks NEO, survives reload, and announces only once`,()=>{
  const p=createProgress(),s=victory('hard',ending);assert.equal(recordVictory(p,s),true);
  const restored=createProgress(JSON.parse(JSON.stringify(p)));
  assert.equal(canStartChallenge(restored,'neo'),true);assert.equal(recordVictory(restored,s),false);
  recordVictory(restored,victory('easy'));assert.equal(neoUnlocked(restored),true);
});
test('losing, starting or abandoning Encore never unlocks NEO',()=>{
  for(const mode of ['lobby','menu','dodge','lost']){
    const p=createProgress(),s=createState('hard');s.mode=mode;
    assert.equal(recordVictory(p,s),false);assert.equal(neoUnlocked(p),false);
  }
});
test('corrupted progress and a mismatched boss cannot grant the unlock',()=>{
  for(const raw of [null,{},'bad',{clears:{hard:'true'}},{clears:{normal:true}},{neoUnlocked:true}])assert.equal(neoUnlocked(createProgress(raw)),false);
  const p=createProgress(),s=victory('neo');s.difficulty='hard';recordVictory(p,s);assert.equal(neoUnlocked(p),false);
});
