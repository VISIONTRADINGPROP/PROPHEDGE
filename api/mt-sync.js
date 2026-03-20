// api/mt-sync.js
// Riceve i trade da MT4/MT5 EA e li salva su Supabase
// Endpoint: POST /api/mt-sync

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      token,        // Token Supabase dell'utente
      journal_id,   // ID sessione journal
      account_type, // 'prop' o 'broker'
      account_id,   // Numero conto MT
      platform,     // 'MT4' o 'MT5'
      trades        // Array di trade
    } = req.body;

    if (!token || !journal_id || !account_type || !trades) {
      return res.status(400).json({ error: 'Parametri mancanti' });
    }

    // Verifica il token utente
    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Token non valido' });
    }

    // Processa ogni trade
    const results = { inserted: 0, updated: 0, errors: 0 };

    for (const trade of trades) {
      const tradeData = {
        user_id:      user.id,
        journal_id:   journal_id,
        account_type: account_type,
        ticket:       trade.ticket,
        symbol:       trade.symbol,
        direction:    trade.type === 0 ? 'BUY' : 'SELL', // MT4: 0=BUY, 1=SELL
        volume:       trade.lots,
        open_price:   trade.open_price,
        close_price:  trade.close_price || null,
        stop_loss:    trade.sl || null,
        take_profit:  trade.tp || null,
        profit:       trade.profit || 0,
        swap:         trade.swap || 0,
        commission:   trade.commission || 0,
        status:       trade.close_time ? 'closed' : 'open',
        open_time:    trade.open_time ? new Date(trade.open_time * 1000).toISOString() : null,
        close_time:   trade.close_time ? new Date(trade.close_time * 1000).toISOString() : null,
        comment:      trade.comment || '',
        magic_number: trade.magic || null,
        platform:     platform || 'MT4',
        account_id:   account_id || ''
      };

      // Upsert: inserisce o aggiorna se il ticket esiste già
      const { error } = await sb
        .from('trades')
        .upsert(tradeData, {
          onConflict: 'user_id,journal_id,account_type,ticket',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('Trade upsert error:', error.message);
        results.errors++;
      } else {
        results.inserted++;
      }
    }

    return res.status(200).json({
      success: true,
      processed: trades.length,
      ...results
    });

  } catch (err) {
    console.error('mt-sync error:', err.message);
    return res.status(500).json({ error: 'Errore interno: ' + err.message });
  }
};
