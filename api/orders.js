// api/orders.js
// Gestisce i comandi dal software all'EA (apri/chiudi/modifica)
// POST /api/orders        → crea un nuovo ordine
// GET  /api/orders?token=...&journal_id=...&account_type=... → EA fa polling

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // ── POST: il software crea un ordine ─────────────────────────
  if (req.method === 'POST') {
    const { token, journal_id, account_type, action, symbol, direction,
            volume, stop_loss, take_profit, ticket } = req.body;

    if (!token || !journal_id || !account_type || !action) {
      return res.status(400).json({ error: 'Parametri mancanti' });
    }

    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Token non valido' });

    const { data, error } = await sb.from('orders').insert({
      user_id:      user.id,
      journal_id,
      account_type,
      action,
      symbol:       symbol || '',
      direction:    direction || null,
      volume:       volume || null,
      stop_loss:    stop_loss || null,
      take_profit:  take_profit || null,
      ticket:       ticket || null,
      status:       'pending'
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, order: data });
  }

  // ── GET: l'EA fa polling degli ordini pending ─────────────────
  if (req.method === 'GET') {
    const { token, journal_id, account_type } = req.query;
    if (!token || !journal_id || !account_type) {
      return res.status(400).json({ error: 'Parametri mancanti' });
    }

    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Token non valido' });

    const { data, error } = await sb.from('orders')
      .select('*')
      .eq('user_id', user.id)
      .eq('journal_id', journal_id)
      .eq('account_type', account_type)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ orders: data || [] });
  }

  // ── PATCH: l'EA aggiorna lo stato ordine (executed/failed) ────
  if (req.method === 'PATCH') {
    const { token, order_id, status, error_msg, ticket } = req.body;
    if (!token || !order_id || !status) {
      return res.status(400).json({ error: 'Parametri mancanti' });
    }

    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Token non valido' });

    const update = {
      status,
      executed_at: new Date().toISOString(),
      error_msg:   error_msg || null
    };
    if (ticket) update.ticket = ticket;

    const { error } = await sb.from('orders')
      .update(update)
      .eq('id', order_id)
      .eq('user_id', user.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
