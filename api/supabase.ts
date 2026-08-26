const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseReady() {
  return Boolean(url && key);
}

export async function sb(path: string, options: RequestInit = {}) {
  if (!url || !key) throw new Error('Supabase is not configured in Vercel.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function sbJson(
  path: string,
  body?: unknown,
  method = 'POST',
  headers: Record<string, string> = {},
) {
  const response = await sb(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error('Supabase request failed', response.status, path, detail.slice(0, 300));
    throw new Error('The Splitmate database request failed.');
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
