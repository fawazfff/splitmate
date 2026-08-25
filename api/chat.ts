type Person={id:string,name:string,wallet?:string};
type Exp={title:string,amount:number,paid:string,split:string[]};
type Trip={id:string,name:string,people:Person[],expenses:Exp[]};

const MODEL=process.env.OPENAI_MODEL||'gpt-5.6-luna';

const system=`You are Splitmate Agent, a friendly AI expense-management agent inside the Splitmate app.
Your ONLY job is to help with Splitmate, the current trip, group expenses, balances, splitting, settlement planning, wallets, Base payments, and how to use the app.
If a user asks about anything unrelated, politely refuse and say you can help with Splitmate expenses, balances, settlements, wallets, and the current trip.
You can understand natural language and should turn clear expense instructions into structured actions.
Never invent people, expenses, balances, wallet addresses, or transaction results.
Never claim a blockchain payment happened. Payments require an explicit user click and wallet approval.
Money calculations must be based on the supplied trip data. The application validates action amounts.
Return ONLY valid JSON with this shape: {"message":"short friendly response","action":null|{"type":"add_expense","title":string,"amount":number,"paidBy":string,"splitBetween":string[]}}.
Only use add_expense when the user clearly supplied enough information to add an expense. paidBy and splitBetween must be person IDs from the supplied trip data. If information is missing, ask for it and use action:null.
For questions about balances or settlement, explain using the supplied data. Do not create payment actions. The UI will handle payment approval.`;

export default async function handler(req:any,res:any){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const key=process.env.OPENAI_API_KEY;
  if(!key) return res.status(500).json({error:'OPENAI_API_KEY is not configured in Vercel.'});
  try{
    const {message,trip}=req.body||{};
    if(typeof message!=='string'||!message.trim()||!trip) return res.status(400).json({error:'Message and trip are required.'});
    const context={
      trip:{name:trip.name,people:trip.people,expenses:trip.expenses},
      balances:calculateBalances(trip)
    };
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
      body:JSON.stringify({model:MODEL,input:[{role:'system',content:system},{role:'user',content:`Trip context:\n${JSON.stringify(context)}\n\nUser message:\n${message}`}],max_output_tokens:500,temperature:0.2})
    });
    if(!response.ok){const text=await response.text();return res.status(502).json({error:'OpenAI request failed',details:text.slice(0,500)})}
    const data=await response.json();
    const text=data.output_text||extractOutput(data);
    let result:any;
    try{result=JSON.parse(text)}catch{result={message:text,action:null}}
    return res.status(200).json({message:result.message||'I can help with your Splitmate trip.',action:result.action||null});
  }catch(error:any){return res.status(500).json({error:error?.message||'Agent request failed.'})}
}
function calculateBalances(trip:Trip){const b:Record<string,number>=Object.fromEntries(trip.people.map(p=>[p.id,0]));for(const e of trip.expenses||[]){if(b[e.paid]===undefined)continue;b[e.paid]+=Number(e.amount);for(const id of e.split||[])if(b[id]!==undefined)b[id]-=Number(e.amount)/(e.split||[]).length;}return trip.people.map(p=>({personId:p.id,name:p.name,balance:Number((b[p.id]||0).toFixed(2))}));}
function extractOutput(data:any){for(const item of data.output||[]){for(const c of item.content||[]){if(c.type==='output_text'&&c.text)return c.text;}}return '{"message":"I could not process that request.","action":null}';}
