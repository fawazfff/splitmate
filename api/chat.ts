import { ensureConversation, getOwnedGroupRow, groupFromRow, isUuid } from '../server/groups.js';
import { consumeAgentRateLimit } from '../server/rateLimit.js';
import type { AgentAction, Group, Person } from '../src/types.js';
import { sbJson, supabaseReady } from './supabase.js';

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-nano';

const system = `You are Splitmate Agent, an action-oriented shared-expense operator. You are NOT a generic chatbot.
SCOPE: shared expenses, group members, balances, spending analysis, settlement planning, wallets, Base payments and using Splitmate. Politely redirect unrelated questions to shared money.
MEMORY: Treat the supplied conversation history as working memory. Never restart a questionnaire. Resolve short replies such as “10”, “Fawaz”, “dinner”, “everyone”, “yes”, “that one”, and “the last one” from the latest unresolved question and current group data. Never ask for a fact already present.
IDENTITY: CURRENT USER identifies the group member represented by “I”, “me”, “my”, and “you”. Never assume that person is named Fawaz.
EXPENSE CAPTURE: Required facts are description, amount and payer. Every expense is always split equally between every current group member. Never ask who should split an expense and never create a partial split. Extract every complete expense in the message. If incomplete, ask ONLY for the next missing fact. Corrections replace an unconfirmed draft. The UI always asks the human to confirm before saving.
ACTIONS: add_expense, add_expenses, update_expense, delete_expense, add_person, show_settlement, analyze_spending, explain_balance, or none. When adding, changing, or deleting data, prepare an action for explicit UI confirmation. Never claim the change was saved before confirmation.
PAYMENTS: Never claim a payment happened. The dedicated Final Settlement screen sends native USDC on Base mainnet and the payer approves it in their wallet.
Return ONLY valid JSON: {"message":string,"action":null|{...}}.
Allowed actions: {"type":"add_expense","title":string,"amount":number,"paidBy":personId,"splitBetween":[all current personIds]}; {"type":"add_expenses","expenses":[{"title":string,"amount":number,"paidBy":personId,"splitBetween":[all current personIds]}]}; {"type":"update_expense","expenseIndex":number,"title"?:string,"amount"?:number,"paidBy"?:personId,"splitBetween"?:[all current personIds]}; {"type":"delete_expense","expenseIndex":number}; {"type":"add_person","name":string,"wallet"?:string}; {"type":"show_settlement","all":boolean}; {"type":"analyze_spending"}; {"type":"explain_balance"}. Keep replies concise.`;

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: 'The Splitmate Agent is not configured.' });
  if (!supabaseReady()) return res.status(503).json({ error: 'Agent memory is not configured.' });

  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const clientId = String(req.body?.clientId || '');
    const suppliedTrip = req.body?.trip as Group | undefined;
    if (!message || message.length > 1_000 || !isUuid(clientId) || !suppliedTrip) {
      return res.status(400).json({ error: 'Message and a valid group are required.' });
    }

    if (!(await consumeAgentRateLimit(req, clientId))) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ error: 'The Agent is receiving too many messages. Try again in one minute.' });
    }

    const isDemo = suppliedTrip.id === 'demo';
    let trip: Group;
    let conversationId: string | null = null;
    let history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (isDemo) {
      trip = suppliedTrip;
      history = cleanHistory(req.body?.history);
    } else {
      let row = await getOwnedGroupRow(String(suppliedTrip.id || ''), clientId);
      // A group can open locally a moment before its first background save
      // reaches the database. Give that save a short chance to finish before
      // telling the Agent that the group does not exist.
      for (let attempt = 0; !row && attempt < 2; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
        row = await getOwnedGroupRow(String(suppliedTrip.id || ''), clientId);
      }
      if (!row) return res.status(404).json({ error: 'Group not found.' });
      trip = groupFromRow(row);
      const conversation = await ensureConversation(trip.id);
      conversationId = conversation?.id || null;
      if (conversationId) history = await loadHistory(conversationId);
    }

    if (trip.people.length < 2 || trip.expenses.length > 500) {
      return res.status(400).json({ error: 'This group cannot be processed.' });
    }

    const requestedPerson = String(req.body?.currentPersonId || '');
    const currentPerson = trip.people.find((person) => person.id === requestedPerson) || trip.people[0];
    let result = understandExpense(message, history, trip, currentPerson);

    if (!result) {
      const context = {
        currentUser: currentPerson,
        group: { name: trip.name, people: trip.people, expenses: trip.expenses },
        balances: calculateBalances(trip),
      };
      const input = [
        { role: 'system', content: system },
        ...history,
        {
          role: 'user',
          content: `CURRENT USER:\n${JSON.stringify(currentPerson)}\n\nCURRENT GROUP DATA:\n${JSON.stringify(context)}\n\nLATEST USER MESSAGE:\n${message}`,
        },
      ];

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: MODEL, input, max_output_tokens: 700 }),
      });
      if (!response.ok) {
        console.error('OpenAI request failed', response.status);
        return res.status(502).json({ error: 'The Agent could not respond just now.' });
      }
      const data = await response.json();
      const text = data.output_text || extractOutput(data);
      try {
        const parsed = JSON.parse(text);
        const action = sanitizeAction(parsed.action, trip);
        result = {
          message: typeof parsed.message === 'string' ? parsed.message.slice(0, 1_200) : 'Done.',
          action,
        };
      } catch {
        result = { message: 'Tell me what happened with the shared expense, or ask who owes whom.', action: null };
      }
    }

    if (conversationId) {
      try {
        await sbJson('agent_messages', [
          { conversation_id: conversationId, role: 'user', content: message },
          { conversation_id: conversationId, role: 'assistant', content: result.message || '' },
        ]);
        await sbJson(
          `agent_conversations?id=eq.${encodeURIComponent(conversationId)}`,
          { updated_at: new Date().toISOString() },
          'PATCH',
          { Prefer: 'return=minimal' },
        );
      } catch (error) {
        console.error('Agent memory save failed', error);
      }
    }

    return res.status(200).json({
      message: result.message || 'Done.',
      action: result.action || null,
      conversationId,
    });
  } catch (error) {
    console.error('chat handler error', error);
    return res.status(500).json({ error: 'The Agent request failed.' });
  }
}

function cleanHistory(value: unknown) {
  return Array.isArray(value)
    ? value.slice(-40).flatMap((item: any) => {
        if (!item || typeof item.content !== 'string') return [];
        return [{
          role: item.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: item.content.slice(0, 1_200),
        }];
      })
    : [];
}

async function loadHistory(conversationId: string) {
  const rows = await sbJson(
    `agent_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&select=role,content,message_order&order=message_order.desc&limit=40`,
    undefined,
    'GET',
  );
  return cleanHistory(Array.isArray(rows) ? rows.reverse() : rows);
}

function sanitizeAction(value: unknown, trip: Group): AgentAction | null {
  if (!value || typeof value !== 'object') return null;
  const action = value as Record<string, any>;
  const memberIds = new Set(trip.people.map((person) => person.id));
  const cleanSplit = (split: unknown) =>
    Array.isArray(split)
      ? [...new Set(split.filter((id): id is string => typeof id === 'string' && memberIds.has(id)))]
      : [];

  if (action.type === 'add_expense') {
    const amount = Number(action.amount);
    const splitBetween = cleanSplit(action.splitBetween);
    if (
      typeof action.title !== 'string' ||
      !action.title.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1_000_000 ||
      !memberIds.has(action.paidBy) ||
      splitBetween.length === 0
    ) return null;
    return {
      type: 'add_expense',
      title: action.title.trim().slice(0, 120),
      amount: Number(amount.toFixed(6)),
      paidBy: action.paidBy,
      splitBetween: trip.people.map((person) => person.id),
    };
  }
  if (action.type === 'add_expenses' && Array.isArray(action.expenses) && action.expenses.length > 0 && action.expenses.length <= 20) {
    const expenses = action.expenses.flatMap((expense: any) => {
      const amount = Number(expense?.amount);
      if (
        !expense ||
        typeof expense.title !== 'string' ||
        !expense.title.trim() ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 1_000_000 ||
        !memberIds.has(expense.paidBy)
      ) return [];
      return [{
        title: expense.title.trim().slice(0, 120),
        amount: Number(amount.toFixed(6)),
        paidBy: expense.paidBy,
        splitBetween: trip.people.map((person) => person.id),
      }];
    });
    return expenses.length === action.expenses.length ? { type: 'add_expenses', expenses } : null;
  }
  if (action.type === 'update_expense') {
    const expenseIndex = Number(action.expenseIndex);
    if (!Number.isInteger(expenseIndex) || !trip.expenses[expenseIndex]) return null;
    const next: Extract<AgentAction, { type: 'update_expense' }> = { type: 'update_expense', expenseIndex };
    if (typeof action.title === 'string' && action.title.trim()) next.title = action.title.trim().slice(0, 120);
    if (action.amount !== undefined) {
      const amount = Number(action.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null;
      next.amount = Number(amount.toFixed(6));
    }
    if (action.paidBy !== undefined) {
      if (!memberIds.has(action.paidBy)) return null;
      next.paidBy = action.paidBy;
    }
    if (action.splitBetween !== undefined) {
      const splitBetween = cleanSplit(action.splitBetween);
      if (splitBetween.length === 0) return null;
      next.splitBetween = splitBetween;
    }
    return next;
  }
  if (action.type === 'delete_expense') {
    const expenseIndex = Number(action.expenseIndex);
    return Number.isInteger(expenseIndex) && trip.expenses[expenseIndex]
      ? { type: 'delete_expense', expenseIndex }
      : null;
  }
  if (action.type === 'add_person') {
    const name = typeof action.name === 'string' ? action.name.trim().slice(0, 80) : '';
    const wallet = typeof action.wallet === 'string' ? action.wallet.trim() : '';
    if (!name || trip.people.length >= 30 || (wallet && !/^0x[a-fA-F0-9]{40}$/.test(wallet))) return null;
    return { type: 'add_person', name, wallet: wallet || undefined };
  }
  if (action.type === 'show_settlement') return { type: 'show_settlement', all: true };
  if (action.type === 'analyze_spending') return { type: 'analyze_spending' };
  if (action.type === 'explain_balance') return { type: 'explain_balance' };
  return null;
}

function understandExpense(
  latest: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  trip: Group,
  currentPerson: Person,
): { message: string; action: AgentAction | null } | null {
  const people = trip.people;
  const everyone = people.map((person) => person.id);
  const previousUsers = history
    .filter((item) => item.role === 'user')
    .map((item) => item.content.trim())
    .filter(Boolean)
    .slice(-10);
  const previousAssistants = history
    .filter((item) => item.role === 'assistant')
    .map((item) => item.content.trim())
    .filter(Boolean)
    .slice(-5);
  const lastAssistant = previousAssistants.at(-1) || '';

  if (/\b(explain|why).*(balance|owe|owed)|\bmy balance\b/i.test(latest)) {
    return { message: 'I’ll explain the current group balance from the recorded expenses.', action: { type: 'explain_balance' } };
  }
  if (/\b(who\s+owes|owe|owes|balance|settle|settlement|pay\s+who|who\s+pays)\b/i.test(latest)) {
    return { message: 'I’ll calculate the current balances and prepare the simplest settlement.', action: { type: 'show_settlement', all: true } };
  }
  if (/\b(analy[sz]e|analysis|spending|spent|expense\s+breakdown|where.*money)\b/i.test(latest)) {
    return { message: 'Analyzing your group’s saved expenses.', action: { type: 'analyze_spending' } };
  }

  const draftMatch = lastAssistant.match(/I understood this:\s+(.+?) paid \$([0-9]+(?:\.[0-9]+)?) for (.+?), split between/i);
  const correctedAmount = latest.match(/^(?:no,?\s*)?(?:it was|actually|make it)\s*\$?([0-9]+(?:[.,][0-9]{1,6})?)/i);
  if (draftMatch && correctedAmount) {
    const payer = people.find((person) => person.name.toLowerCase() === draftMatch[1].trim().toLowerCase());
    const amount = Number(correctedAmount[1].replace(',', '.'));
    const title = draftMatch[3].trim();
    if (payer && Number.isFinite(amount) && amount > 0 && title) {
      return {
        message: `I updated the draft: ${payer.name} paid $${amount.toFixed(2)} for ${title}, split between everybody.`,
        action: { type: 'add_expense', title, amount, paidBy: payer.id, splitBetween: everyone, replacesPending: true },
      };
    }
  }

  const isExpenseFollowUp = /\bwho paid|\bhow much|\bwhat was (?:it|the|this expense) for/i.test(lastAssistant);
  if (!/\b(paid|paying|pay|covered|spent|bought|buying|got|purchased|purchase|expense|cost|costs)\b/i.test(latest) && !isExpenseFollowUp) {
    return null;
  }

  const personToken = [...people.map((person) => escapeRegExp(person.name)), 'I', 'we'].join('|');
  const payerVerb = '(?:paid|paying|covered|spent|bought|buying|purchased|purchase|got)';
  const startsExpense = new RegExp(`(?:${personToken})\\s+${payerVerb}\\b`, 'i');
  const directSegments = latest.split(new RegExp(`\\s+(?:and|then)\\s+(?=(?:${personToken})\\s+${payerVerb}\\b)`, 'i'));

  const findPerson = (text: string) => {
    const normalized = text.trim().toLowerCase();
    if (/^(i|me|myself)$/i.test(normalized)) return currentPerson;
    return people.find((person) => person.name.toLowerCase() === normalized)
      || people.find((person) => person.name.toLowerCase().includes(normalized) || normalized.includes(person.name.toLowerCase()));
  };
  const payerIntent = (text: string) => /\b(paid|paying|pay|covered|spent|bought|buying|got|purchased|purchase)\b/i.test(text);
  const detectPayer = (sources: string[]) => {
    for (const source of sources) {
      if (!payerIntent(source)) continue;
      if (/^\s*(?:i|we)\s+(?:paid|pay|covered|spent|bought|purchased)\b/i.test(source)) return currentPerson;
      for (const person of people) {
        if (new RegExp(`\\b${escapeRegExp(person.name)}\\b\\s+${payerVerb}\\b`, 'i').test(source)) return person;
      }
    }
    return undefined;
  };
  const detectAmount = (sources: string[]) => {
    for (const source of sources) {
      const matches = [...source.matchAll(/(?:\$|usd\s*)?([0-9]+(?:[.,][0-9]{1,6})?)(?:\s*(?:usd|dollars?|bucks|usdc))?/gi)];
      if (matches.length) {
        const amount = Number(matches[0][1].replace(',', '.'));
        if (Number.isFinite(amount)) return amount;
      }
    }
    return undefined;
  };
  const titleFrom = (text: string) => {
    const patterns = [
      /\b(?:paid|spent|covered)\s+(?:about\s+|around\s+)?(?:\$?[0-9]+(?:[.,][0-9]{1,6})?\s*(?:usd|dollars?|bucks|usdc)?\s+)?(?:for|on)\s+(.+?)(?=\s+for\s+(?:everyone|us|the\s+group)\b|\s+(?:with|costing)\s+(?:\$?[0-9]+)|\s+\$?[0-9]+\s*(?:usd|dollars?|bucks|usdc)\b|[.!?]|$)/i,
      /\b(?:bought|buying|purchased|purchase|got)\s+(?:some\s+|a\s+|an\s+)?(.+?)(?=\s+(?:for\s+(?:everyone|us|the\s+group)|with\s+(?:\$?[0-9]+)|\$?[0-9]+\s*(?:usd|dollars?|bucks|usdc)\b)|[.!?]|$)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = match[1]
          .replace(/\s+(?:split|shared?)\s+(?:with|between|among)\b.*$/i, '')
          .trim()
          .replace(/[.!?]+$/, '');
        if (value && !/^(everyone|us|the group)$/i.test(value)) return value;
      }
    }
    return /\b(dinner|lunch|breakfast|drinks?|transport|taxi|uber|hotel|rent|groceries|food|tickets?|flight|gas|fuel|coffee|snacks?|shopping)\b/i.exec(text)?.[1];
  };

  const makeExpense = (source: string) => {
    if (!startsExpense.test(source)) return undefined;
    const payer = detectPayer([source]);
    const amount = detectAmount([source]);
    const title = titleFrom(source);
    return payer && amount !== undefined && title
      ? { title, amount, paidBy: payer.id, splitBetween: everyone }
      : undefined;
  };

  if (directSegments.length > 1) {
    const expenses = directSegments.map(makeExpense);
    if (expenses.every(Boolean)) {
      const confirmedExpenses = expenses as Array<{ title: string; amount: number; paidBy: string; splitBetween: string[] }>;
      return {
        message: `I found ${confirmedExpenses.length} expenses. They will each be split between everybody.`,
        action: { type: 'add_expenses', expenses: confirmedExpenses },
      };
    }
  }

  const sources = isExpenseFollowUp ? [latest, ...previousUsers.slice().reverse()] : [latest];
  let payer = detectPayer(sources);
  let amount = detectAmount(sources);
  let title: string | undefined;
  for (const source of sources) {
    title = titleFrom(source);
    if (title) break;
  }

  if (!title && /\bwhat was (?:it|the|this expense) for\??$/i.test(lastAssistant) && !payerIntent(latest) && detectAmount([latest]) === undefined) {
    title = latest.replace(/^[\"']|[\"']$/g, '').trim().slice(0, 120);
  }
  if (amount === undefined && /\bhow much(?: was it)?\??$/i.test(lastAssistant)) amount = detectAmount([latest]);
  if (!payer && /\bwho paid(?: for it| for this)?\??$/i.test(lastAssistant)) payer = findPerson(latest);

  if (!payer) return { message: 'Who paid for it?', action: null };
  if (amount === undefined) return { message: 'How much was it?', action: null };
  if (!title) return { message: 'What was it for?', action: null };

  return {
    message: `I understood this: ${payer.name} paid $${amount.toFixed(2)} for ${title}, split between everybody.`,
    action: { type: 'add_expense', title, amount, paidBy: payer.id, splitBetween: everyone },
  };
}

function calculateBalances(trip: Group) {
  const balances: Record<string, number> = Object.fromEntries(trip.people.map((person) => [person.id, 0]));
  for (const expense of trip.expenses || []) {
    if (balances[expense.paid] === undefined || expense.split.length === 0) continue;
    balances[expense.paid] += Number(expense.amount);
    for (const id of expense.split) {
      if (balances[id] !== undefined) balances[id] -= Number(expense.amount) / expense.split.length;
    }
  }
  for (const settlement of trip.settlements || []) {
    if (settlement.status !== 'confirmed') continue;
    if (balances[settlement.from] !== undefined) balances[settlement.from] += settlement.amount;
    if (balances[settlement.to] !== undefined) balances[settlement.to] -= settlement.amount;
  }
  return trip.people.map((person) => ({ personId: person.id, name: person.name, balance: Number((balances[person.id] || 0).toFixed(2)) }));
}

function escapeRegExp(value: string) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function extractOutput(data: any) {
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  return '{"message":"I could not process that request.","action":null}';
}
