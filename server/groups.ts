import { sbJson } from '../api/supabase.js';
import type { Expense, Group, Person, SettlementRecord } from '../src/types.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH = /^0x[a-fA-F0-9]{64}$/;
const MAX_AVATAR_DATA_URL_LENGTH = 2_800_000;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function cleanPerson(value: unknown): Person | null {
  if (!value || typeof value !== 'object') return null;
  const person = value as Partial<Person>;
  const name = typeof person.name === 'string' ? person.name.trim().slice(0, 80) : '';
  if (!isUuid(person.id) || !name) return null;
  const wallet = typeof person.wallet === 'string' ? person.wallet.trim() : '';
  if (wallet && !EVM_ADDRESS.test(wallet)) return null;
  const avatar = typeof person.avatar === 'string' ? person.avatar : '';
  if (avatar && (!avatar.startsWith('data:image/') || avatar.length > MAX_AVATAR_DATA_URL_LENGTH)) return null;
  return { id: person.id, name, wallet: wallet || undefined, avatar: avatar || undefined };
}

function cleanExpense(value: unknown, memberIds: Set<string>): Expense | null {
  if (!value || typeof value !== 'object') return null;
  const expense = value as Partial<Expense>;
  const title = typeof expense.title === 'string' ? expense.title.trim().slice(0, 120) : '';
  const amount = Number(expense.amount);
  const split = Array.isArray(expense.split)
    ? [...new Set(expense.split.filter((id): id is string => typeof id === 'string' && memberIds.has(id)))]
    : [];
  if (
    !isUuid(expense.id) ||
    !title ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1_000_000 ||
    typeof expense.paid !== 'string' ||
    !memberIds.has(expense.paid) ||
    split.length === 0
  ) {
    return null;
  }
  return { id: expense.id, title, amount: Number(amount.toFixed(6)), paid: expense.paid, split };
}

function cleanSettlement(value: unknown, memberIds: Set<string>): SettlementRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<SettlementRecord>;
  const amount = Number(record.amount);
  if (
    !isUuid(record.id) ||
    typeof record.from !== 'string' ||
    typeof record.to !== 'string' ||
    !memberIds.has(record.from) ||
    !memberIds.has(record.to) ||
    record.from === record.to ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1_000_000 ||
    typeof record.txHash !== 'string' ||
    !TX_HASH.test(record.txHash) ||
    !['submitted', 'confirmed', 'failed'].includes(String(record.status)) ||
    typeof record.submittedAt !== 'string'
  ) {
    return null;
  }
  return {
    id: record.id,
    from: record.from,
    to: record.to,
    amount: Number(amount.toFixed(6)),
    txHash: record.txHash as `0x${string}`,
    status: record.status as SettlementRecord['status'],
    submittedAt: record.submittedAt,
    confirmedAt: typeof record.confirmedAt === 'string' ? record.confirmedAt : undefined,
    error: typeof record.error === 'string' ? record.error.slice(0, 240) : undefined,
  };
}

export function validateGroup(value: unknown): Group {
  if (!value || typeof value !== 'object') throw new Error('Invalid group data.');
  if (JSON.stringify(value).length > 6_000_000) throw new Error('This group is too large to save.');
  const group = value as Partial<Group>;
  const name = typeof group.name === 'string' ? group.name.trim().slice(0, 100) : '';
  if (!isUuid(group.id) || !name || !Array.isArray(group.people) || !Array.isArray(group.expenses)) {
    throw new Error('Invalid group data.');
  }
  if (group.people.length < 2 || group.people.length > 30 || group.expenses.length > 500) {
    throw new Error('The group size is outside the supported limits.');
  }
  const people = group.people.map(cleanPerson);
  if (people.some((person) => !person)) throw new Error('One or more group members are invalid.');
  const cleanPeople = people as Person[];
  const memberIds = new Set(cleanPeople.map((person) => person.id));
  if (memberIds.size !== cleanPeople.length) throw new Error('Group member IDs must be unique.');
  const expenses = group.expenses.map((expense) => cleanExpense(expense, memberIds));
  if (expenses.some((expense) => !expense)) throw new Error('One or more expenses are invalid.');
  const settlements = Array.isArray(group.settlements)
    ? group.settlements.slice(-100).map((record) => cleanSettlement(record, memberIds))
    : [];
  if (settlements.some((record) => !record)) throw new Error('One or more settlement records are invalid.');
  return {
    id: group.id,
    name,
    people: cleanPeople,
    expenses: expenses as Expense[],
    settlements: settlements as SettlementRecord[],
  };
}

export function groupFromRow(row: any): Group {
  return validateGroup({ ...row.state, id: row.id, name: row.name });
}

export async function getOwnedGroupRow(groupId: string, clientId: string) {
  if (!isUuid(groupId) || !isUuid(clientId)) return undefined;
  const rows = await sbJson(
    `groups?id=eq.${encodeURIComponent(groupId)}&client_id=eq.${encodeURIComponent(clientId)}&select=id,name,state,client_id,updated_at&limit=1`,
    undefined,
    'GET',
  );
  return Array.isArray(rows) ? rows[0] : undefined;
}

// A group is cached locally before the first cloud write completes. If that
// initial write was interrupted, an Agent request can safely repair the record
// only when no other browser owns this group ID.
export async function recoverLocalGroup(groupInput: unknown, clientId: string) {
  const group = validateGroup(groupInput);
  if (!isUuid(clientId)) return undefined;
  const existing = await sbJson(
    `groups?id=eq.${encodeURIComponent(group.id)}&select=id,client_id&limit=1`,
    undefined,
    'GET',
  );
  if (existing?.[0]?.client_id && existing[0].client_id !== clientId) return undefined;
  if (!existing?.[0]) {
    const now = new Date().toISOString();
    await sbJson(
      'groups?on_conflict=id',
      { id: group.id, name: group.name, client_id: clientId, state: group, updated_at: now },
      'POST',
      { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    );
  }
  return getOwnedGroupRow(group.id, clientId);
}

export async function ensureConversation(groupId: string) {
  const rows = await sbJson(
    'agent_conversations?on_conflict=group_id',
    { group_id: groupId, updated_at: new Date().toISOString() },
    'POST',
    { Prefer: 'resolution=merge-duplicates,return=representation' },
  );
  return Array.isArray(rows) ? rows[0] : undefined;
}
