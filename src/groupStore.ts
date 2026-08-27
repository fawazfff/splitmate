import type { Group } from './types';

const STORAGE_KEY = 'splitmate.groups.v2';
const LEGACY_KEY = 'splitmate.groups';
const CLIENT_KEY = 'splitmate.client-id';
const REQUEST_TIMEOUT_MS = 12_000;

function normalizeGroup(value: Partial<Group>): Group | null {
  if (!value.id || !value.name || !Array.isArray(value.people) || !Array.isArray(value.expenses)) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    settlementNetwork: value.settlementNetwork === 'base-sepolia' ? 'base-sepolia' : 'base-mainnet',
    people: value.people,
    expenses: value.expenses.map((expense) => ({
      ...expense,
      id: expense.id || crypto.randomUUID(),
    })),
    settlements: Array.isArray(value.settlements) ? value.settlements : [],
  };
}

function readKey(key: string): Group[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeGroup).filter((group): group is Group => Boolean(group));
  } catch {
    return [];
  }
}

export function loadLocalGroups(): Group[] {
  const merged = [...readKey(STORAGE_KEY), ...readKey(LEGACY_KEY)];
  return [...new Map(merged.map((group) => [group.id, group])).values()];
}

export function loadLocalGroup(id: string): Group | undefined {
  return loadLocalGroups().find((group) => group.id === id);
}

export function cacheGroup(group: Group) {
  if (group.id === 'demo') return;
  const next = [group, ...loadLocalGroups().filter((item) => item.id !== group.id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 20)));
}

export function getClientId() {
  let clientId = localStorage.getItem(CLIENT_KEY);
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(CLIENT_KEY, clientId);
  }
  return clientId;
}

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Splitmate could not save your group.');
  return data;
}

async function requestWithTimeout(input: RequestInfo | URL, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') {
      throw new Error('Cloud sync took too long. Your group is saved on this device and will retry when you make your next change.');
    }
    throw reason;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function persistGroup(group: Group): Promise<Group> {
  if (group.id === 'demo') return group;
  cacheGroup(group);
  const response = await requestWithTimeout('/api/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: getClientId(), group }),
  });
  const data = await parseResponse(response);
  const saved = normalizeGroup(data.group) || group;
  cacheGroup(saved);
  return saved;
}

export async function fetchGroup(id: string): Promise<Group | undefined> {
  if (id === 'demo') return undefined;
  const params = new URLSearchParams({ id, clientId: getClientId() });
  const response = await requestWithTimeout(`/api/groups?${params.toString()}`, { method: 'GET' });
  if (response.status === 404) return undefined;
  const data = await parseResponse(response);
  const group = normalizeGroup(data.group);
  if (group) cacheGroup(group);
  return group || undefined;
}

export async function fetchRecentGroups(): Promise<Group[]> {
  const params = new URLSearchParams({ clientId: getClientId() });
  const response = await requestWithTimeout(`/api/groups?${params.toString()}`, { method: 'GET' });
  const data = await parseResponse(response);
  const groups = Array.isArray(data.groups)
    ? data.groups.map(normalizeGroup).filter((group: Group | null): group is Group => Boolean(group))
    : [];
  for (const group of groups) cacheGroup(group);
  return groups;
}
