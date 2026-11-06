import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSolver,validateAnswers} from './solver.mjs';
const questions=[{q:'She ___ happy.',options:['is','are','am']}];
test('validates count, types and zero-based boundaries',()=>{
  assert.deepEqual(validateAnswers({answers:[0]},questions,'english'),{answers:[0]});
  for(const answers of [[],[3],[-1],['0'],[0,1],[null]]) assert.throws(()=>validateAnswers({answers},questions,'english'));
});
test('request contains schema, option texts, no credentials and no streaming',async()=>{
  const solver=createSolver({fetchImpl:async(url,init)=>{
    assert.equal(url.pathname,'/api/chat');
    assert.deepEqual(init.headers,{'Content-Type':'application/json'});
    const b=JSON.parse(init.body);
    assert.equal(b.stream,false); assert.equal(b.format.properties.answers.maxItems,1);
    assert.equal(JSON.parse(b.messages[1].content).questions[0].options[0],'is');
    return Response.json({done:true,message:{content:'{"answers":["is"]}'}});
  }});
  assert.deepEqual(await solver.solve(questions),{answers:[0]});
});
test('malformed, truncated and HTTP-error responses fail closed',async()=>{
  for(const result of [{done:true,message:{content:'not json'}},{done:true,message:{content:'{"answers":[5]}'}},{done:false,message:{content:'{"answers":["is"]}'}},{done:true,done_reason:'length',message:{content:'{"answers":["is"]}'}}]) {
    await assert.rejects(createSolver({fetchImpl:async()=>Response.json(result)}).solve(questions));
  }
  await assert.rejects(createSolver({fetchImpl:async()=>new Response('',{status:500})}).solve(questions),/HTTP 500/);
});
test('expired deadlines prevent requests and cancellation reaches fetch',async()=>{
  let calls=0;
  const solver=createSolver({fetchImpl:async(_url,init)=>{calls++;init.signal.throwIfAborted();throw new Error('unexpected');}});
  await assert.rejects(solver.solve(questions,{deadline:Date.now()+1000}),/Too little time/);
  assert.equal(calls,0);
  await assert.rejects(solver.solve(questions,{signal:AbortSignal.abort()}),{name:'AbortError'});
});
test('remote Ollama URLs rejected and math answers validated',()=>{
  assert.throws(()=>createSolver({url:'https://example.com'}),/localhost/);
  assert.deepEqual(validateAnswers({answers:['42']},['6*7'],'quiz'),{answers:['42']});
  assert.throws(()=>validateAnswers({answers:['42 apples']},['6*7'],'quiz'));
});
