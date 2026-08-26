import { ensureConversation, getOwnedGroupRow, isUuid } from '../server/groups.js';
import { sbJson, supabaseReady } from './supabase.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (!supabaseReady()) return res.status(503).json({ error: 'Agent memory is not configured.' });

  try {
    const clientId = String(req.method === 'GET' ? req.query?.clientId || '' : req.body?.clientId || '');
    const groupId = String(req.method === 'GET' ? req.query?.groupId || '' : req.body?.groupId || '');
    if (!isUuid(clientId) || !isUuid(groupId)) {
      return res.status(400).json({ error: 'Invalid conversation request.' });
    }
    if (!(await getOwnedGroupRow(groupId, clientId))) {
      return res.status(404).json({ error: 'Group not found.' });
    }
    const conversation = await ensureConversation(groupId);
    if (!conversation?.id) return res.status(500).json({ error: 'Conversation could not be prepared.' });

    if (req.method === 'GET') {
      const messages = await sbJson(
        `agent_messages?conversation_id=eq.${encodeURIComponent(conversation.id)}&select=role,content,created_at&order=created_at.desc&limit=40`,
        undefined,
        'GET',
      );
      return res.status(200).json({
        conversationId: conversation.id,
        messages: Array.isArray(messages) ? messages.reverse() : [],
      });
    }

    if (req.method === 'POST' && req.body?.action === 'reset') {
      await sbJson(
        `agent_messages?conversation_id=eq.${encodeURIComponent(conversation.id)}`,
        undefined,
        'DELETE',
        { Prefer: 'return=minimal' },
      );
      return res.status(200).json({ conversationId: conversation.id, messages: [] });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('conversation handler error', error);
    return res.status(500).json({ error: 'Agent memory request failed.' });
  }
}
