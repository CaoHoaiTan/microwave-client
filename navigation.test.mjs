import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arithmetic,blocked,findPath} from './navigation.mjs';
test('arithmetic accepts supported expressions without evaluating code',()=>{
  assert.equal(arithmetic('12 × -3'),'-36');
  assert.equal(arithmetic('12 ÷ 3 = ?'),'4');
  assert.equal(arithmetic('1/0'),null);
  assert.equal(arithmetic('process.exit()'),null);
});
test('path goes around a wall and ends near target',()=>{
  const map={w:12,h:10,tile:32};
  const objects=[{solid:true,px:150,py:0,pw:32,ph:200},{task:'coffee',cx:280,cy:80,solid:true,px:264,py:64,pw:32,ph:32}];
  const path=findPath(map,objects,{x:80,y:80},'coffee');
  assert.ok(path.some(p=>p.y>=208));
  let prev={x:80,y:80};
  for(const p of path) {assert.equal(blocked(map,objects,p.x,p.y),false);assert.equal(Math.hypot(p.x-prev.x,p.y-prev.y),8);prev=p;}
  assert.ok(Math.hypot(prev.x-280,prev.y-80)<map.tile*1.8);
});
test('unreachable destination fails',()=>{
  assert.throws(()=>findPath({w:10,h:10,tile:32},[{solid:true,px:150,py:0,pw:32,ph:320},{task:'coffee',cx:280,cy:80}],{x:80,y:80},'coffee'),/No accessible/);
});
