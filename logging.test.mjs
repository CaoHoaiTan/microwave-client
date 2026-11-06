import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hideSecret,redact,requestJson} from './logging.mjs';
test('nested credentials and echoed secret values are redacted without changing answers',()=>{
  hideSecret('test-password-123');
  const input={password:'test-password-123',headers:{Cookie:'session=abc',Authorization:'Bearer xyz'},body:{access_token:'secret',answers:[0,2],message:'echo test-password-123'}};
  const output=redact(input);
  assert.equal(output.password,'[REDACTED]');
  assert.equal(output.headers.Cookie,'[REDACTED]');
  assert.equal(output.headers.Authorization,'[REDACTED]');
  assert.equal(output.body.access_token,'[REDACTED]');
  assert.equal(output.body.message,'echo [REDACTED]');
  assert.deepEqual(output.body.answers,[0,2]);
  assert.equal(input.password,'test-password-123');
});
test('logs exact request/response and matching correlation id on HTTP error',async()=>{
  const entries=[];
  const result=await requestJson('GAME','https://example.test/api/tasks/coffee/submit',{method:'POST',body:JSON.stringify({answers:[2]})},{
    log:(event,data)=>entries.push({event,data}),
    fetchImpl:async()=>Response.json({error:'Cooldown',cooldownLeft:351000},{status:429})
  });
  assert.equal(result.response.status,429);
  assert.deepEqual(entries[0].data.body,{answers:[2]});
  assert.equal(entries[1].data.body.cooldownLeft,351000);
  assert.equal(entries[0].event.split('#')[1],entries[1].event.split('#')[1]);
});
test('non-JSON and network errors are logged',async()=>{
  const entries=[];const log=(event,data)=>entries.push({event,data});
  await assert.rejects(requestJson('GAME','https://example.test',{}, {log,fetchImpl:async()=>new Response('Bad gateway',{status:502})}),/non-JSON/);
  assert.ok(entries.some(e=>e.data.body==='Bad gateway' && e.data.status===502));
  await assert.rejects(requestJson('GAME','https://example.test',{}, {log,fetchImpl:async()=>{throw new Error('Connection lost');}}),/Connection lost/);
  assert.equal(entries.at(-1).data.message,'Connection lost');
});
