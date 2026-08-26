const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseReady() {
  return Boolean(url && key);
}

export async function sb(path: string, options: RequestInit = {}) {
  if (!url || !key) throw new Error('Supabase is not configured in Vercel.');
  const request = async () => {
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
  };

  // A newly started Vercel function can occasionally be a few seconds ahead
  // of Supabase's JWT clock. Retrying that precise transient response avoids
  // dropping a new group or Agent message on the first request.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await request();
    if (response.status !== 401) return response;
    const detail = await response.clone().text();
    if (!detail.includes('PGRST303') || !detail.includes('JWT issued at future') || attempt === 2) return response;
    await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
  }
  throw new Error('Supabase request retry was unexpectedly exhausted.');
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
