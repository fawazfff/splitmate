import { createHash } from 'node:crypto';
import { sbJson } from '../api/supabase.js';

export async function consumeAgentRateLimit(req: any, clientId: string) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const address = forwarded || String(req.headers?.['x-real-ip'] || 'unknown');
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const [clientAllowed, addressAllowed] = await Promise.all([
    sbJson('rpc/consume_api_rate_limit', {
      p_key: hash(`${clientId}:splitmate-agent-client`),
      p_limit: 20,
      p_window_seconds: 60,
    }),
    sbJson('rpc/consume_api_rate_limit', {
      p_key: hash(`${address}:splitmate-agent-address`),
      p_limit: 60,
      p_window_seconds: 60,
    }),
  ]);
  return clientAllowed === true && addressAllowed === true;
}
