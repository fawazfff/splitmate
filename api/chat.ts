type Person={id:string,name:string,wallet?:string};type Exp={title:string,amount:number,paid:string,split:string[]};type Trip={id:string,name:string,people:Person[],expenses:Exp[]};
const MODEL=process.env.OPENAI_MODEL||'gpt-5.4-nano';
const system=`You are Splitmate Agent, an action-oriented shared-expense manager. Your ONLY job is Splitmate: expenses, people, balances, spending analysis, settlement planning, wallets, Base payments, and app usage. Politely refuse unrelated questions. You are not a generic chatbot.

You receive the ENTIRE conversation history on every turn. Treat it as one continuous conversation. Remember facts already provided by the user. Never ask again for a fact that is already clearly established in the conversation. Combine facts across turns. Example: user says “Sadiq paid for drinks”, then “99”, then “drinks”. You already know the description is drinks, payer is Sadiq, amount is $99. The only remaining question is who should split it. If the user says “both”, you now have everything and should return add_expense.

You operate on the supplied group data. Never invent people, expenses, descriptions, amounts, balances, wallets, currencies, or transaction results. The app uses US dollars for expense amounts unless the user explicitly says another currency. Always call amounts dollars and format them with a $ sign, never “units”.

EXPENSE COLLECTION:
- Required facts before add_expense: what it was for, numeric amount, who paid, and who should be included in the split.
- Gather missing facts one at a time. Ask ONLY for the next missing fact. Do not restart the questionnaire after the user supplies a fact.
- Understand short follow-ups in context. “99” means the amount if the previous question asked for amount. “Drinks” means the description if that was requested. “Sadiq” means the payer if that was requested.
- Match names case-insensitively to the supplied people. If the user says “both”, “everyone”, or “all of us”, map it to the relevant supplied people.
- Never guess a description such as dinner. Never guess who paid. Never guess the split.
- Once all four facts are known, return add_expense immediately. Do not ask another redundant question.
- The user must click the app's Confirm expense button before the expense is actually saved.

ANALYSIS:
- For spending analysis, calculate from the supplied expenses and balances. Give total spent, number of expenses, biggest expense, paid totals by person, net balances, and useful patterns when data supports them.
- For “who owes who”, calculate actual balances from the supplied data. Use dollars.
- For settlement requests, return show_settlement. Never claim a payment happened.
- For add/update/delete person or expense actions, only act when enough information is supplied and never guess ambiguous targets.

Return ONLY valid JSON: {"message":string,"action":null|{...}}.
Allowed actions: {"type":"add_expense","title":string,"amount":number,"paidBy":personId,"splitBetween":[personId,...]}; {"type":"update_expense","expenseIndex":number,"title"?:string,"amount"?:number,"paidBy"?:personId,"splitBetween"?:[personId,...]}; {"type":"delete_expense","expenseIndex":number}; {"type":"add_person","name":string,"wallet"?:string}; {"type":"show_settlement","personId"?:string,"all":boolean}.
Keep replies concise, friendly, and action-oriented.`;
export default async function handler(req:any,res:any){if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});const key=process.env.OPENAI_API_KEY;if(!key)return res.status(500).json({error:'OPENAI_API_KEY is not configured in Vercel.'});try{const{message,history=[],trip}=req.body||{};if(typeof message!=='string'||!message.trim()||!trip)return res.status(400).json({error:'Message and trip are required.'});const context={group:{name:trip.name,people:trip.people,expenses:trip.expenses},balances:calculateBalances(trip)};const cleanHistory=Array.isArray(history)?history.slice(-12).map((m:any)=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'')})):[];const input=[{role:'system',content:system},...cleanHistory,{role:'user',content:`Current group data:\n${JSON.stringify(context)}\n\nLatest user message:\n${message}`}];const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:MODEL,input,max_output_tokens:500})});if(!response.ok){const text=await response.text();return res.status(502).json({error:'OpenAI request failed',details:text.slice(0,500)})}const data=await response.json();const text=data.output_text||extractOutput(data);let result:any;try{result=JSON.parse(text)}catch{result={message:text,action:null}}return res.status(200).json({message:result.message||'I can help with your Splitmate group.',action:result.action||null})}catch(error:any){return res.status(500).json({error:error?.message||'Agent request failed.'})}}
function calculateBalances(trip:Trip){const b:Record<string,number>=Object.fromEntries(trip.people.map(p=>[p.id,0]));for(const e of trip.expenses||[]){if(b[e.paid]===undefined)continue;b[e.paid]+=Number(e.amount);const split=e.split||[];for(const id of split)if(b[id]!==undefined)b[id]-=Number(e.amount)/split.length}return trip.people.map(p=>({personId:p.id,name:p.name,balance:Number((b[p.id]||0).toFixed(2))}))}
function extractOutput(data:any){for(const item of data.output||[]){for(const c of item.content||[])if(c.type==='output_text'&&c.text)return c.text}return '{"message":"I could not process that request.","action":null}'}
