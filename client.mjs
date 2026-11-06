import { io } from 'socket.io-client';
import { setTimeout as sleep } from 'node:timers/promises';
import { findPath, arithmetic } from './navigation.mjs';
import { createSolver } from './solver.mjs';
import { trace, requestJson } from './logging.mjs';

const args = process.argv.slice(2);
const execute = args.includes('--run');
const selected = args.filter(a=>!a.startsWith('--'));
const taskIds = selected.length ? selected : ['coffee','plant','trash','quiz','typing','printer'];
if (args.some(a=>a.startsWith('--') && !['--run','--help'].includes(a))) throw new Error('Unknown option');
if (args.includes('--help')) {
  console.log('npm start -- [--run] [coffee plant trash quiz typing printer]\nDefault: inspect only. --run: move and perform each selected task once. English: automatically answered by local Ollama.');
  process.exit(0);
}
if (taskIds.some(t=>!['coffee','plant','trash','quiz','typing','printer'].includes(t))) throw new Error('Unknown task');
const base = new URL(process.env.GAME_URL || 'https://steven00763.duckdns.org');
if (base.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('HTTPS required');
let cookie = '', socket, position, connectionLost = false, solver;
const abort = new AbortController();
process.once('SIGINT', () => { abort.abort(); socket?.disconnect(); });
async function api(path, body) {
  if (abort.signal.aborted) throw new Error('Cancelled');
  const requestedAt=Date.now();
  const {response:res,data} = await requestJson('GAME',new URL(`/api${path}`, base), {
    method: body === undefined ? 'GET':'POST', redirect:'error',
    headers: { ...(cookie ? {Cookie:cookie}:{}), ...(body === undefined ? {} : {'Content-Type':'application/json'}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)])
  });
  const cookies = res.headers.getSetCookie();
  if (cookies.length) {
    const jar = new Map(cookie.split('; ').filter(Boolean).map(v=>[v.slice(0,v.indexOf('=')),v]));
    for (const c of cookies) { const pair=c.split(';')[0]; jar.set(pair.slice(0,pair.indexOf('=')),pair); }
    cookie=[...jar.values()].join('; ');
  }
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${data.error || 'Request failed'}. Stopping without retry.`);
  if (data && typeof data==='object') Object.defineProperty(data,'requestedAt',{value:requestedAt});
  return data;
}
async function payload(view) {
  const ch=view.challenge;
  if (!ch || !Number.isFinite(ch.timeLimit) || ch.timeLimit<=0) throw new Error('Unexpected challenge schema');
  const deadline=view.requestedAt+ch.timeLimit*1000;
  trace('TASK challenge',{task:view.task,stage:view.game,deadline:new Date(deadline).toISOString(),challenge:ch});
  if (view.game==='english') {
    return solver.solve(ch.questions,{kind:'english',deadline,signal:abort.signal});
  }
  if (view.game==='quiz') {
    const answers=ch.questions.map(arithmetic);
    const missing=answers.map((answer,i)=>answer===null?i:-1).filter(i=>i>=0);
    if(missing.length) {
      const result=await solver.solve(missing.map(i=>ch.questions[i]),{kind:'quiz',deadline,signal:abort.signal});
      missing.forEach((index,i)=>{answers[index]=result.answers[i];});
    }
    return {answers};
  }
  if (view.game==='typing') {
    if (typeof ch.sentence!=='string') throw new Error('Missing sentence');
    return {text:ch.sentence};
  }
  if (view.game==='printer') {
    if (!Array.isArray(ch.sequence) || !Number.isFinite(ch.showMs) || ch.showMs<0 || ch.showMs>=ch.timeLimit*1000) throw new Error('Unexpected printer schema');
    await sleep(ch.showMs+100,undefined,{signal:abort.signal});
    return {sequence:ch.sequence};
  }
  throw new Error(`Unknown stage: ${view.game}`);
}

try {
  if(!process.env.GAME_USERNAME || !process.env.GAME_PASSWORD) throw new Error('Set GAME_USERNAME and GAME_PASSWORD in .env');
  if(execute) {solver=createSolver();await solver.warmup(abort.signal);}
  await api('/login',{username:process.env.GAME_USERNAME,password:process.env.GAME_PASSWORD});
  const world=await api('/me');
  if(world.user?.needsEmail) throw new Error('Complete account setup in the website first');
  console.table(world.objects.filter(o=>taskIds.includes(o.task)).map(o=>({task:o.task,label:o.label,x:o.cx,y:o.cy})));
  if (!execute) {
    console.log('Inspect only. Add --run to move and submit tasks.');
  } else {
    socket=io(base.origin,{autoConnect:false,extraHeaders:{Cookie:cookie},reconnection:false,timeout:10000});
    socket.on('connect',()=>trace('SOCKET connected'));
    socket.on('disconnect',reason=>{trace('SOCKET disconnected',{reason});connectionLost=true; abort.abort();});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Socket init timeout')),15000);
      const fail=e=>{trace('SOCKET error',{message:e.message});clearTimeout(timer);reject(e);};
      socket.once('connect_error',fail);
      socket.once('init',d=>{
        clearTimeout(timer);
        const self=d.players?.find(p=>p.id===d.selfId);
        if (!Number.isFinite(self?.x)||!Number.isFinite(self?.y)) return reject(new Error('Missing player position'));
        position={x:self.x,y:self.y,dir:self.dir||'down'};trace('SOCKET init',{position});resolve();
      });
      socket.connect();
    });
    for (const id of taskIds) {
      const state=await api('/tasks');
      const task=state.tasks.find(t=>t.id===id);
      if(!task) throw new Error(`Task unavailable: ${id}`);
      if(state.earnedToday>=state.cap) {console.log('Daily cap reached.');break;}
      if(task.cooldownLeft>0) {trace('TASK skipped: cooldown',{task:id,cooldownLeftMs:task.cooldownLeft,remainingSeconds:Math.ceil(task.cooldownLeft/1000),availableAt:new Date(Date.now()+task.cooldownLeft).toISOString(),action:'Skipped; no start or submit request sent. Run again after availableAt.'});continue;}
      const route=findPath(world.map,world.objects,position,id);
      console.log(`${id}: walking ${route.length*8}px`);
      for(const point of route) {
        await sleep(90,undefined,{signal:abort.signal});
        if(connectionLost || !socket.connected) throw new Error('Socket disconnected');
        const dir=point.x===position.x ? (point.y>position.y?'down':'up') : (point.x>position.x?'right':'left');
        position={...point,dir};trace('SOCKET emit move',{...position,moving:true});socket.emit('move',{...position,moving:true});
      }
      trace('SOCKET emit move',{...position,moving:false});socket.emit('move',{...position,moving:false});
      await sleep(300,undefined,{signal:abort.signal});
      let view=await api(`/tasks/${id}/start`,{});
      for(let stage=0;!view.done;stage++) {
        if(stage>=4) throw new Error('Too many stages');
        const answer=await payload(view);
        trace('TASK answers prepared',{task:id,stage:view.game,questions:view.challenge.questions,answer,indexConvention:'English answers are zero-based: 0 = first option.'});
        if(Date.now()>=view.requestedAt+view.challenge.timeLimit*1000-1000) throw new Error('Challenge deadline reached; not submitting');
        view=await api(`/tasks/${id}/submit`,answer);
      }
      trace('TASK completed',{task:id,result:view});
    }
  }
} catch(error) {
  trace('RUN failed',{name:error.name,message:error.message,cause:error.cause?.message});process.exitCode=1;
} finally {
  socket?.disconnect();cookie='';
}
