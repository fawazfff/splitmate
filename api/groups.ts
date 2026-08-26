import { ensureConversation, getOwnedGroupRow, groupFromRow, isUuid, validateGroup } from '../server/groups.js';
import { sbJson, supabaseReady } from './supabase.js';

function noStore(res: any) {
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req: any, res: any) {
  noStore(res);
  if (!supabaseReady()) return res.status(503).json({ error: 'Group sync is not configured.' });

  try {
    if (req.method === 'GET') {
      const clientId = String(req.query?.clientId || '');
      const groupId = req.query?.id ? String(req.query.id) : '';
      if (!isUuid(clientId) || (groupId && !isUuid(groupId))) {
        return res.status(400).json({ error: 'Invalid group request.' });
      }

      if (groupId) {
        const row = await getOwnedGroupRow(groupId, clientId);
        if (!row) return res.status(404).json({ error: 'Group not found.' });
        return res.status(200).json({ group: groupFromRow(row) });
      }

      const rows = await sbJson(
        `groups?client_id=eq.${encodeURIComponent(clientId)}&select=id,name,state,updated_at&order=updated_at.desc&limit=12`,
        undefined,
        'GET',
      );
      return res.status(200).json({ groups: (rows || []).map(groupFromRow) });
    }

    if (req.method === 'POST') {
      const clientId = String(req.body?.clientId || '');
      if (!isUuid(clientId)) return res.status(400).json({ error: 'Invalid browser identity.' });
      let group;
      try {
        group = validateGroup(req.body?.group);
      } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid group data.' });
      }

      const existing = await sbJson(
        `groups?id=eq.${encodeURIComponent(group.id)}&select=client_id&limit=1`,
        undefined,
        'GET',
      );
      if (existing?.[0]?.client_id && existing[0].client_id !== clientId) {
        return res.status(403).json({ error: 'This group belongs to another browser.' });
      }

      const now = new Date().toISOString();
      const rows = await sbJson(
        'groups?on_conflict=id',
        { id: group.id, name: group.name, client_id: clientId, state: group, updated_at: now },
        'POST',
        { Prefer: 'resolution=merge-duplicates,return=representation' },
      );
      await ensureConversation(group.id);
      const saved = rows?.[0] ? groupFromRow(rows[0]) : group;
      return res.status(existing?.length ? 200 : 201).json({ group: saved });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('groups handler error', error);
    return res.status(500).json({ error: 'Splitmate could not sync this group.' });
  }
}
