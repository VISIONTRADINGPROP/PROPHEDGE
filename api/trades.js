// api/trades.js
// GET  → legge trade dal database
// POST → salva/aggiorna trade nel database

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token mancante' });

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Verifica utente
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Non autorizzato' });

  // ── GET: leggi trade ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { status, platform, limit = 100, offset = 0 } = req.query;
    let query = sb.from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);
    if (platform) query = query.eq('platform', platform);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ trades: data, count: data.length });
  }

  // ── POST: salva/aggiorna trade ────────────────────────────────
  if (req.method === 'POST') {
    const { action, trades: tradesToSave, trade } = req.body;

    // Salva batch di trade (sync da piattaforma)
    if (action === 'sync' && tradesToSave) {
      const rows = tradesToSave.map(t => ({
        ...t,
        user_id: user.id,
        updated_at: new Date().toISOString()
      }));

      // Upsert: aggiorna se external_id + platform + user_id già esiste
      const { data, error } = await sb.from('trades')
        .upsert(rows, {
          onConflict: 'user_id,external_id,platform',
          ignoreDuplicates: false
        })
        .select();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ saved: data.length, trades: data });
    }

    // Salva singolo trade manuale
    if (trade) {
      const { data, error } = await sb.from('trades')
        .insert({ ...trade, user_id: user.id })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ trade: data });
    }

    return res.status(400).json({ error: 'Parametri mancanti' });
  }

  // ── DELETE: elimina trade ─────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID mancante' });

    const { error } = await sb.from('trades')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ deleted: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
};
