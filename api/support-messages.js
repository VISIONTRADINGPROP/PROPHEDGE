// /api/support-messages.js
// Il software controlla ogni 5s se ci sono nuove risposte dal supporto

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { ticket_id, after } = req.query;
  if (!ticket_id) return res.status(400).json({ error: 'ticket_id richiesto' });

  try {
    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    let query = sb.from('support_messages')
      .select('*')
      .eq('ticket_id', ticket_id)
      .eq('role', 'support')
      .order('created_at', { ascending: true });

    if (after) query = query.gt('created_at', after);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ messages: data || [] });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
