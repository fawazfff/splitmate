import { sbJson, supabaseReady } from './supabase.js';

type Person = { id: string; name: string; wallet?: string };
type Exp = { title: string; amount: number; paid: string; split: string[] };
type Trip = { id: string; name: string; people: Person[]; expenses: Exp[] };

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-nano';

const system = `You are Splitmate Agent, an action-oriented shared-expense operator. You are NOT a generic chatbot.
SCOPE: shared expenses, group members, balances, spending analysis, settlement planning, wallets, Base payments and using Splitmate. For unrelated questions politely redirect to shared money.
MEMORY: Treat the full supplied conversation history as working memory. Never restart a questionnaire. Short replies such as “10”, “Fawaz”, “dinner”, “sugar cane”, “both”, “everyone”, “yes”, “that one”, and “the last one” MUST be resolved from the latest unresolved question and current group data. Never ask for a fact that is already present in the conversation or the current group.
EXPENSE CAPTURE: Required facts are description, amount, payer and split members. Extract complete expenses from natural language such as “Fawaz paid $50 for dinner for everyone.” “Fatima paid $35 for transport.” “I paid $10 for coffee.” “Ibrahim paid for sugar cane with 50 dollars.” If complete, return add_expense immediately. If incomplete, ask ONLY for the next missing fact. If the user answers that question, fill the missing field and continue rather than asking the same question again. A short answer can be the missing description, amount, payer, or split. “Everyone” means all current group members. If the user says “yes” after a complete summary, keep the same action. Do not save until the UI confirmation.
CORRECTIONS: A correction replaces the previous value. Do not restart the flow.
ACTIONS: add_expense, update_expense, delete_expense, add_person, show_settlement, analyze_spending, explain_balance, or none.
ANALYSIS: Use current expenses and balances. Concrete amounts use dollars and $. Never claim a payment happened. Settlement is handled by the dedicated screen. Prefer the fewest transfers.
Return ONLY valid JSON: {"message":string,"action":null|{...}}.
Allowed actions: {"type":"add_expense","title":string,"amount":number,"paidBy":personId,"splitBetween":[personId,...]}; {"type":"update_expense","expenseIndex":number,"title"?:string,"amount"?:number,"paidBy"?:personId,"splitBetween"?:[personId,...]}; {"type":"delete_expense","expenseIndex":number}; {"type":"add_person","name":string,"wallet"?:string}; {"type":"show_settlement","all":boolean}; {"type":"analyze_spending"}; {"type":"explain_balance"}. Keep replies concise.`;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured in Vercel.' });

  try {
    const { message, history = [], trip, conversationId } = req.body || {};
    if (typeof message !== 'string' || !message.trim() || !trip) {
      return res.status(400).json({ error: 'Message and trip are required.' });
    }

    const cleanHistory = Array.isArray(history)
      ? history.slice(-40).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || ''),
        }))
      : [];

    const deterministic = understandExpense(message.trim(), cleanHistory, trip);
    let result: any;

    if (deterministic) {
      result = deterministic;
    } else {
      const context = {
        group: { name: trip.name, people: trip.people, expenses: trip.expenses },
        balances: calculateBalances(trip),
      };
      const input = [
        { role: 'system', content: system },
        ...cleanHistory,
        {
          role: 'user',
          content: `CURRENT GROUP DATA:\n${JSON.stringify(context)}\n\nLATEST USER MESSAGE:\n${message}`,
        },
      ];

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ model: MODEL, input, max_output_tokens: 700 }),
      });

      if (!response.ok) return res.status(502).json({ error: 'OpenAI request failed' });
      const data = await response.json();
      const text = data.output_text || extractOutput(data);
      try {
        result = JSON.parse(text);
      } catch {
        result = {
          message: 'Tell me what happened with the shared expense, or ask who owes who.',
          action: null,
        };
      }
    }

    let cid = conversationId || null;
    if (supabaseReady()) {
      try {
        if (!cid) {
          const groups = await sbJson(
            `groups?name=eq.${encodeURIComponent(trip.name)}&select=id&limit=1`,
            undefined,
            'GET'
          );
          const groupId = groups[0]?.id;
          if (groupId) {
            const conversations = await sbJson('agent_conversations', { group_id: groupId });
            cid = conversations[0]?.id || null;
          }
        }
        if (cid) {
          await sbJson('agent_messages', { conversation_id: cid, role: 'user', content: message });
          await sbJson('agent_messages', {
            conversation_id: cid,
            role: 'assistant',
            content: result.message || '',
          });
        }
      } catch (e) {
        console.error('Supabase memory save failed', e);
      }
    }

    return res.status(200).json({
      message: result.message || 'Done.',
      action: result.action || null,
      conversationId: cid,
    });
  } catch (error: any) {
    console.error('chat handler error', error);
    return res.status(500).json({ error: error?.message || 'Agent request failed.' });
  }
}

function understandExpense(latest: string, history: any[], trip: Trip) {
  const people = trip.people || [];
  const userMessages = history
    .filter((m: any) => m.role === 'user')
    .map((m: any) => String(m.content || '').trim())
    .filter(Boolean);
  const recentUsers = userMessages.slice(-10);
  const previousUsers = recentUsers.slice(0, -1);
  const previousAssistant = history
    .filter((m: any) => m.role === 'assistant')
    .map((m: any) => String(m.content || '').trim())
    .filter(Boolean)
    .slice(-5);

  if (/\b(explain|why).*(balance|owe|owed)|\bmy balance\b/i.test(latest)) {
    return {
      message: 'I’ll explain the current group balance from the recorded expenses.',
      action: { type: 'explain_balance' },
    };
  }
  if (/\b(who\s+owes|owe|owes|balance|settle|settlement|pay\s+who|who\s+pays)\b/i.test(latest)) {
    return {
      message: 'I’ll calculate the current balances and prepare the simplest settlement for your group.',
      action: { type: 'show_settlement', all: true },
    };
  }
  if (/\b(analy[sz]e|analysis|spending|spent|expense\s+breakdown|where.*money)\b/i.test(latest)) {
    return {
      message: 'Analyzing your group’s spending using the saved expenses.',
      action: { type: 'analyze_spending' },
    };
  }

  const allExpenseText = [...previousUsers, latest].join(' ');
  const hasExpenseIntent = /\b(paid|paying|pay|covered|spent|bought|buying|got|purchased|purchase|expense|cost|costs)\b/i.test(allExpenseText);
  if (!hasExpenseIntent) return null;

  const findPerson = (s: string) => {
    const n = s.trim().toLowerCase();
    return (
      people.find((p) => p.name.toLowerCase() === n) ||
      people.find((p) => p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase()))
    );
  };

  const isPayerText = (s: string) =>
    /\b(paid|paying|pay|covered|spent|bought|buying|got|purchased|purchase|covered\s+it)\b/i.test(s);

  const detectPayer = (sources: string[]) => {
    for (const source of sources) {
      if (!isPayerText(source)) continue;
      for (const person of people) {
        if (new RegExp(`\\b${escapeRegExp(person.name)}\\b`, 'i').test(source)) return person;
      }
    }
    return undefined;
  };

  let payer = detectPayer([latest, ...previousUsers.slice().reverse()]);
  if (!payer && /^\s*(?:i|we)\s+(?:paid|pay|covered|spent|bought|purchased)\b/i.test(latest)) {
    const self = people.find((p) => /^fawaz$/i.test(p.name));
    if (self) payer = self;
  }

  const detectAmount = (sources: string[]) => {
    for (const source of sources) {
      const matches = [
        ...source.matchAll(/(?:\$|usd\s*)?([0-9]+(?:[.,][0-9]{1,2})?)(?:\s*(?:usd|dollars?|bucks))?/gi),
      ];
      if (matches.length) {
        const n = Number(matches[matches.length - 1][1].replace(',', '.'));
        if (Number.isFinite(n)) return n;
      }
    }
    return undefined;
  };

  let amount = detectAmount([latest, ...previousUsers.slice().reverse()]);

  const titleFrom = (s: string) => {
    const patterns = [
      /\b(?:paid|spent|covered)\s+(?:about\s+|around\s+)?(?:\$?[0-9]+(?:[.,][0-9]{1,2})?\s*(?:usd|dollars?|bucks)?\s+)?(?:for|on)\s+(.+?)(?=\s+(?:with|costing)\s+(?:\$?[0-9]+)|\s+\$?[0-9]+\s*(?:usd|dollars?|bucks)\b|[.!?]|$)/i,
      /\b(?:bought|buying|purchased|purchase|got)\s+(?:some\s+|a\s+|an\s+)?(.+?)(?=\s+(?:for\s+(?:everyone|us|the\s+group)|with\s+(?:\$?[0-9]+)|\$?[0-9]+\s*(?:usd|dollars?|bucks)\b)|[.!?]|$)/i,
      /\b(?:for|on)\s+(?:a|an|the)\s+(.+?)(?=\s+(?:with|for)\s+\$?[0-9]+|\s+\$?[0-9]+\s*(?:usd|dollars?|bucks)\b|[.!?]|$)/i,
    ];
    for (const pattern of patterns) {
      const match = s.match(pattern);
      if (match?.[1]) {
        const value = match[1].trim().replace(/[.!?]+$/, '');
        if (value && !/^(everyone|us|the group)$/i.test(value)) return value;
      }
    }
    const known = /\b(dinner|lunch|breakfast|drinks?|transport|taxi|uber|hotel|rent|groceries|food|tickets?|flight|gas|fuel|coffee|snacks?|shopping)\b/i.exec(s);
    return known?.[1];
  };

  let title: string | undefined;
  for (const source of [latest, ...previousUsers.slice().reverse()]) {
    const found = titleFrom(source);
    if (found) {
      title = found;
      break;
    }
  }

  // If the Agent just asked for the missing description, the user's short reply IS the description.
  const lastAssistant = previousAssistant[previousAssistant.length - 1] || '';
  const waitingForDescription = /\bwhat was it for\??$/i.test(lastAssistant) || /\bwhat was (?:the|this) expense for\??$/i.test(lastAssistant);
  if (!title && waitingForDescription && latest && !isPayerText(latest) && detectAmount([latest]) === undefined) {
    title = latest.replace(/^["']|["']$/g, '').trim();
  }

  // If the Agent asked for a number and the user gave a short number, use it as the amount.
  const waitingForAmount = /\bhow much was it\??$/i.test(lastAssistant) || /\bhow much\??$/i.test(lastAssistant);
  if (amount === undefined && waitingForAmount) amount = detectAmount([latest]);

  // If the Agent asked who paid and the user answered with a member name, use that member.
  const waitingForPayer = /\bwho paid(?: for it| for this)?\??$/i.test(lastAssistant) || /\bwho paid\??$/i.test(lastAssistant);
  if (!payer && waitingForPayer) payer = findPerson(latest);

  let split = people.map((p) => p.id);
  for (const source of [latest, ...previousUsers.slice().reverse()]) {
    const match = source.match(/\b(?:for|shared with|split with)\s+([^.!?]+)$/i);
    if (!match) continue;
    const part = match[1].trim().replace(/\s+(?:with|using)\s+\$?[0-9]+.*$/i, '').trim();
    if (/^(everyone|all of us|the group)$/i.test(part)) {
      split = people.map((p) => p.id);
      break;
    }
    const names = part.split(/,|\band\b/i).map((x) => x.trim()).filter(Boolean);
    const found = names.map(findPerson).filter(Boolean) as Person[];
    if (found.length) {
      split = found.map((p) => p.id);
      break;
    }
  }

  if (!payer) return { message: 'Who paid for it?', action: null };
  if (amount === undefined) return { message: 'How much was it?', action: null };
  if (!title) return { message: 'What was it for?', action: null };

  return {
    message: `I understood this: ${payer.name} paid $${amount.toFixed(2)} for ${title}, split between ${split.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean).join(', ')}.`,
    action: {
      type: 'add_expense',
      title,
      amount,
      paidBy: payer.id,
      splitBetween: split,
    },
  };
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function calculateBalances(trip: Trip) {
  const b: Record<string, number> = Object.fromEntries(trip.people.map((p) => [p.id, 0]));
  for (const expense of trip.expenses || []) {
    if (b[expense.paid] === undefined) continue;
    b[expense.paid] += Number(expense.amount);
    for (const id of expense.split || []) {
      if (b[id] !== undefined) b[id] -= Number(expense.amount) / (expense.split || []).length;
    }
  }
  return trip.people.map((p) => ({
    personId: p.id,
    name: p.name,
    balance: Number((b[p.id] || 0).toFixed(2)),
  }));
}

function extractOutput(data: any) {
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  return '{"message":"I could not process that request.","action":null}';
}
