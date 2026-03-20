// api/mt-sync.js
// Riceve i trade da MT4/MT5 EA e li salva su Supabase
// Supporta due metodi di autenticazione:
// 1. api_key + email (chiave fissa, non scade mai) ← CONSIGLIATO per EA
// 2. token Supabase (scade, vecchio metodo)

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { token, api_key, email, journal_id, account_type,
            account_id, platform, server, broker, currency,
            balance, equity, trades } = req.body;

    if (!journal_id || !account_type || !trades) {
      return res.status(400).json({ error: 'Mancano journal_id, account_type o trades' });
    }

    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    let userId = null;

    // Metodo 1: api_key + email (non scade mai)
    if (api_key && email) {
      if (api_key !== process.env.MT_API_SECRET) {
        return res.status(401).json({ error: 'API key non valida' });
      }
      const { data: users } = await sb.auth.admin.listUsers();
      const user = (users.users || []).find(u => u.email === email);
      if (!user) return res.status(401).json({ error: 'Utente non trovato: ' + email });
      userId = user.id;
    }
    // Metodo 2: token Supabase (può scadere)
    else if (token) {
      const { data: { user }, error: authError } = await sb.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: 'Token non valido o scaduto' });
      userId = user.id;
    } else {
      return res.status(400).json({ error: 'Autenticazione mancante' });
    }

    // Salva i trade
    let inserted = 0, errors = 0;
    for (const trade of trades) {
      const { error } = await sb.from('trades').upsert({
        user_id:      userId,
        journal_id:   journal_id,
        account_type: account_type,
        ticket:       trade.ticket,
        symbol:       trade.symbol,
        direction:    trade.type === 0 ? 'BUY' : 'SELL',
        volume:       trade.lots,
        open_price:   trade.open_price   || null,
        close_price:  trade.close_price  || null,
        stop_loss:    trade.sl           || null,
        take_profit:  trade.tp           || null,
        profit:       trade.profit       || 0,
        swap:         trade.swap         || 0,
        commission:   trade.commission   || 0,
        status:       (trade.close_time && trade.close_time > 0) ? 'closed' : 'open',
        open_time:    trade.open_time ? new Date(trade.open_time * 1000).toISOString() : null,
        close_time:   (trade.close_time && trade.close_time > 0) ? new Date(trade.close_time * 1000).toISOString() : null,
        comment:      trade.comment   || '',
        magic_number: trade.magic     || null,
        platform:     platform        || 'MT4',
        account_id:   account_id      || ''
      }, { onConflict: 'user_id,journal_id,account_type,ticket' });

      if (error) { console.error('Upsert error:', error.message); errors++; }
      else inserted++;
    }

    return res.status(200).json({ success: true, processed: trades.length, inserted, errors });

  } catch (err) {
    console.error('mt-sync error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
