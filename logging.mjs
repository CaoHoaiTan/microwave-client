const secrets = new Set([process.env.GAME_PASSWORD,process.env.GAME_USERNAME].filter(Boolean));
export function hideSecret(value) { if(value) secrets.add(String(value)); }
export function redact(value, key='') {
  if (/password|cookie|authorization|token|secret|username|email/i.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map(v=>redact(v));
  if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v,k)]));
  if (typeof value==='string') {
    for(const secret of secrets) value=value.split(secret).join('[REDACTED]');
  }
  return value;
}
export function trace(event, data={}) {
  console.log(`[${new Date().toISOString()}] ${event}\n${JSON.stringify(redact(data),null,2)}`);
}
let sequence=0;
export async function requestJson(label,url,init,{fetchImpl=fetch,log=trace}={}) {
  const id=++sequence, started=Date.now();
  let body=init.body;
  try {body=JSON.parse(body);} catch {}
  log(`${label} request #${id}`,{method:init.method || 'GET',url:String(url),headers:init.headers,body});
  try {
    const response=await fetchImpl(url,init);
    for(const cookie of response.headers.getSetCookie()) {
      const pair=cookie.split(';')[0]; hideSecret(pair.slice(pair.indexOf('=')+1));
    }
    const text=await response.text();
    let data;
    try {data=JSON.parse(text);} catch {
      log(`${label} response #${id}`,{status:response.status,elapsedMs:Date.now()-started,body:text});
      throw new Error(`${label}: HTTP ${response.status}, non-JSON response`);
    }
    log(`${label} response #${id}`,{status:response.status,elapsedMs:Date.now()-started,body:data});
    return {response,data};
  } catch(error) {
    log(`${label} error #${id}`,{elapsedMs:Date.now()-started,name:error.name,message:error.message,cause:error.cause?.message});
    throw error;
  }
}
