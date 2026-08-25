import{sbJson,supabaseReady}from'./supabase.js';
type Person={id:string,name:string,wallet?:string};type Exp={title:string,amount:number,paid:string,split:string[]};type Trip={id:string,name:string,people:Person[],expenses:Exp[]};
const MODEL=process.env.OPENAI_MODEL||'gpt-5.4-nano';
const system=`You are Splitmate Agent, an action-oriented shared-expense operator. You are NOT a generic chatbot.

SCOPE: shared expenses, group members, balances, spending analysis, settlement planning, wallets, Base payments and using Splitmate. For unrelated questions politely say your objective is helping with shared money and expenses in Splitmate.

MEMORY: Treat the full supplied conversation history as working memory. Never restart a questionnaire. Resolve short replies such as “99”, “drinks”, “Sadiq”, “both”, “everyone”, “that expense”, and “the last one” from the conversation and CURRENT GROUP DATA. Match names case-insensitively. Never invent facts.

EXPENSE CAPTURE: Required facts are description, amount, payer and split members. Extract them from natural language, including phrases such as “Fawaz paid $50 for dinner for everyone”, “dinner was 50, Fawaz covered it”, “I paid 50 bucks for food”, and “Fatima covered $35 transport”. If the user supplies every required fact, immediately return add_expense. If one or more facts are missing, ask for ONLY the next missing fact, one question at a time. Do not assume dinner, drinks, transport, or any other description unless the user said it. “Everyone” means all current group members. “Both” means the two named people when the context makes that unambiguous. Do not save until the user confirms the completed expense in the UI.

CORRECTIONS: If the user corrects an earlier detail, use the correction. update_expense requires a clear existing expense. delete_expense requires a clear target.

ACTIONS: add_expense, update_expense, delete_expense, add_person, show_settlement, analyze_spending, or none. Use show_settlement when the user asks who owes who, balances, or settlement. Use analyze_spending for spending analysis. Use none for ordinary in-scope explanations.

ANALYSIS: Use current expenses and balances. Never say “analyzing trip”; say “Analyzing your group’s spending” or similar. Concrete numbers should use dollars and $.

SETTLEMENT: Never claim a payment happened. The dedicated settlement screen handles the actual payment. Prefer the fewest transfers.

MONEY: USD by default. Always display dollar amounts with $ and dollars, never “units”.

Return ONLY valid JSON: {"message":string,"action":null|{...}}.
Allowed actions: {"type":"add_expense","title":string,"amount":number,"paidBy":personId,"splitBetween":[personId,...]}; {"type":"update_expense","expenseIndex":number,"title"?:string,"amount"?:number,"paidBy"?:personId,"splitBetween"?:[personId,...]}; {"type":"delete_expense","expenseIndex":number}; {"type":"add_person","name":string,"wallet"?:string}; {"type":"show_settlement","all":boolean}; {"type":"analyze_spending"}. Keep replies concise.`;

export default async function handler(req:any,res:any){if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});const key=process.env.OPENAI_API_KEY;if(!key)return res.status(500).json({error:'OPENAI_API_KEY is not configured in Vercel.'});try{const{message,history=[],trip,conversationId}=req.body||{};if(typeof message!=='string'||!message.trim()||!trip)return res.status(400).json({error:'Message and trip are required.'});
const cleanHistory=Array.isArray(history)?history.slice(-30).map((m:any)=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'')})):[];
const deterministic=understandExpense(message,cleanHistory,trip);
let result:any;
if(deterministic){result=deterministic;}else{const context={group:{name:trip.name,people:trip.people,expenses:trip.expenses},balances:calculateBalances(trip)};const input=[{role:'system',content:system},...cleanHistory,{role:'user',content:`CURRENT GROUP DATA:\n${JSON.stringify(context)}\n\nLATEST USER MESSAGE:\n${message}`}];const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:MODEL,input,max_output_tokens:700})});if(!response.ok){const text=await response.text();return res.status(502).json({error:'OpenAI request failed',details:text.slice(0,500)})}const data=await response.json();const text=data.output_text||extractOutput(data);try{result=JSON.parse(text)}catch{result={message:'I can help with your Splitmate group. Tell me what happened with the expense, or ask who owes who or how the group is spending.',action:null}}}
let cid=conversationId||null;if(supabaseReady()){try{if(!cid){const groups=await sbJson(`groups?name=eq.${encodeURIComponent(trip.name)}&select=id&limit=1`,undefined,'GET');const groupId=groups[0]?.id;if(groupId){const conversations=await sbJson('agent_conversations',{group_id:groupId});cid=conversations[0]?.id||null}}if(cid){await sbJson('agent_messages',{conversation_id:cid,role:'user',content:message});await sbJson('agent_messages',{conversation_id:cid,role:'assistant',content:result.message||''});}}catch(e){console.error('Supabase memory save failed',e)}}return res.status(200).json({message:result.message||'Done.',action:result.action||null,conversationId:cid})}catch(error:any){console.error('chat handler error',error);return res.status(500).json({error:error?.message||'Agent request failed.'})}}

function understandExpense(latest:string,history:any[],trip:Trip){
const text=[...history.filter((m:any)=>m.role==='user').map((m:any)=>m.content),latest].join(' ');const low=latest.toLowerCase();
if(/\b(who\s+owes|owe|owes|balance|settle|settlement|pay\s+who|who\s+pays)\b/i.test(latest))return{message:'I’ll calculate the current balances and prepare the simplest settlement for your group.',action:{type:'show_settlement',all:true}};
if(/\b(analy[sz]e|analysis|spending|spent|expense\s+breakdown|where.*money)\b/i.test(latest))return{message:'Analyzing your group’s spending using the saved expenses.',action:{type:'analyze_spending'}};
const people=trip.people||[];const findPerson=(s:string)=>{const n=s.trim().toLowerCase();return people.find(p=>p.name.toLowerCase()===n)||people.find(p=>p.name.toLowerCase().includes(n)||n.includes(p.name.toLowerCase()))};
let payer:Person|undefined;for(const p of people){const re=new RegExp(`\\b${escapeRegExp(p.name)}\\b`,'i');if(re.test(latest)&&(/\b(paid|paying|covered|spent|bought|got|covered it)\b/i.test(latest))){payer=p;break}}
if(!payer){const payerMatch=latest.match(/^(?:i|we)\s+(?:paid|covered|spent)\b/i);if(payerMatch&&people.length){payer=people.find(p=>/^fawaz$/i.test(p.name))||undefined}}
if(!payer){const previousPayer=history.slice().reverse().map((m:any)=>typeof m.content==='string'?m.content:'').find((s:string)=>/\b(paid|covered|spent)\b/i.test(s));if(previousPayer)for(const p of people)if(new RegExp(`\\b${escapeRegExp(p.name)}\\b`,'i').test(previousPayer)){payer=p;break}}
let amount:number|undefined;const amountMatches=[...text.matchAll(/(?:\$|usd\s*)?([0-9]+(?:[.,][0-9]{1,2})?)(?:\s*(?:usd|dollars?|bucks))?/gi)];if(amountMatches.length)amount=Number(amountMatches[amountMatches.length-1][1].replace(',','.'));
let title:string|undefined;const titlePatterns=[/\bfor\s+(?:everyone|us|the\s+group)\s*$/i,/\bfor\s+(.+?)(?:\s+for\s+(?:everyone|us|the\s+group))?[.!]?$/i,/\b(?:on|for)\s+(?:a|the)\s+(.+?)[.!]?$/i];for(const re of titlePatterns){const m=latest.match(re);if(m&&m[1]&&!/^(everyone|us|the group)$/i.test(m[1].trim())){title=m[1].trim().replace(/[.!?]+$/,'');break}}
if(!title){const known=/\b(dinner|lunch|breakfast|drinks?|transport|taxi|uber|hotel|rent|groceries|food|tickets?|flight|gas|fuel|coffee|snacks?|shopping)\b/i.exec(latest);if(known)title=known[1]}
let split=people.map(p=>p.id);if(/\b(?:for|shared with|split with)\s+([^.!?]+)$/i.test(latest)){const m=latest.match(/\b(?:for|shared with|split with)\s+([^.!?]+)$/i);const part=m?.[1]?.trim();if(part&&/^everyone|all of us|the group$/i.test(part))split=people.map(p=>p.id);else if(part){const names=part.split(/,|\band\b/i).map(x=>x.trim()).filter(Boolean);const found=names.map(findPerson).filter(Boolean) as Person[];if(found.length)split=found.map(p=>p.id)}}
const hasExpenseIntent=/\b(paid|paying|covered|spent|bought|expense|cost|costs)\b/i.test(text);
if(!hasExpenseIntent)return null;
if(!payer)return{message:'Who paid for it?',action:null};
if(amount===undefined||!Number.isFinite(amount))return{message:'How much was it?',action:null};
if(!title)return{message:'What was it for?',action:null};
return{message:`Got it. ${payer.name} paid $${amount.toFixed(2)} for ${title}, split between ${split.map(id=>people.find(p=>p.id===id)?.name).filter(Boolean).join(', ')}. Save this expense?`,action:{type:'add_expense',title,amount,paidBy:payer.id,splitBetween:split}};
}
function escapeRegExp(s:string){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function calculateBalances(trip:Trip){const b:Record<string,number>=Object.fromEntries(trip.people.map(p=>[p.id,0]));for(const e of trip.expenses||[]){if(b[e.paid]===undefined)continue;b[e.paid]+=Number(e.amount);const split=e.split||[];for(const id of split)if(b[id]!==undefined)b[id]-=Number(e.amount)/split.length}return trip.people.map(p=>({personId:p.id,name:p.name,balance:Number((b[p.id]||0).toFixed(2))}))}
function extractOutput(data:any){for(const item of data.output||[]){for(const c of item.content||[])if(c.type==='output_text'&&c.text)return c.text}return '{"message":"I could not process that request.","action":null}'}
