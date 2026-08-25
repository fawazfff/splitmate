const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
export function supabaseReady(){return Boolean(url&&key)}
export async function sb(path:string,options:RequestInit={}){if(!url||!key)throw new Error('Supabase is not configured in Vercel.');return fetch(`${url}/rest/v1/${path}`,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation',...(options.headers||{})}})}
export async function sbJson(path:string,body:any,method='POST'){const r=await sb(path,{method,body:JSON.stringify(body)});if(!r.ok)throw new Error(`Supabase request failed: ${await r.text()}`);return r.json()}
