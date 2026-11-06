import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rewardSummary,formatRewardSummary} from './rewards.mjs';
test('reports actual rewards, zero awards and refreshed totals',()=>{
  const s=rewardSummary('coffee',{reward:0,xp:20},{coins:150,xp:400,level:3});
  assert.match(formatRewardSummary(s),/\+0 MCOIN.*\+20 XP.*150 MCOIN.*400.*Level 3/);
});
test('missing award fields are unknown rather than invented zero',()=>{
  const s=rewardSummary('coffee',{},undefined);
  assert.equal(s.mcoinAwarded,null);
  assert.match(formatRewardSummary(s),/server không trả số điểm/);
  assert.doesNotMatch(formatRewardSummary(s),/Số dư/);
});
test('voided result does not claim a reward even when reward fields exist',()=>{
  const s=rewardSummary('coffee',{voided:true,reward:10,xp:50,message:'Expired'});
  assert.equal(s.mcoinAwarded,null);
  assert.match(formatRewardSummary(s),/bị hủy.*Expired/);
  assert.doesNotMatch(formatRewardSummary(s),/\+10/);
});
