// /api/ctrader-positions.js
// Recupera posizioni aperte e storico trade da cTrader

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token, account_id, env, connected_at } = req.body;

  if (!access_token || !account_id) {
    return res.status(400).json({ error: 'access_token e account_id obbligatori' });
  }

  const baseUrl = 'https://openapi.ctrader.com';

  try {
    // ── Posizioni APERTE ────────────────────────────────────────
    const posRes = await fetch(
      `${baseUrl}/connect/tradingaccounts/${account_id}/positions`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/json',
        },
      }
    );

    let positions = [];
    if (posRes.ok) {
      const posData = await posRes.json();
      const raw = Array.isArray(posData) ? posData : (posData.data || posData.positions || []);

      positions = raw.map(p => ({
        external_id:  String(p.positionId || p.id || ''),
        platform:     'ctrader',
        symbol:       p.symbolName || p.symbol || '',
        direction:    (p.tradeSide || p.side || '').toUpperCase() === 'BUY' ? 'buy' : 'sell',
        volume:       (p.volume || 0) / 100000, // cTrader usa unità x100000
        lots:         (p.volume || 0) / 100000,
        open_price:   p.entryPrice || p.openPrice || 0,
        close_price:  null,
        stop_loss:    p.stopLoss || null,
        take_profit:  p.takeProfit || null,
        profit:       (p.unrealizedGrossPnl || p.pnl || 0) / 100, // centesimi → dollari
        pnl_realized: (p.unrealizedGrossPnl || p.pnl || 0) / 100,
        swap:         (p.swap || 0) / 100,
        commission:   (p.commission || 0) / 100,
        status:       'open',
        open_time:    p.openTimestamp
          ? new Date(p.openTimestamp).toISOString()
          : (p.openTime || new Date().toISOString()),
        close_time:   null,
        opened_at:    p.openTimestamp
          ? new Date(p.openTimestamp).toISOString()
          : new Date().toISOString(),
        comment:      p.comment || '',
      }));
    }

    // ── Storico trade CHIUSI (ultimi 500, filtrati da connected_at) ──
    let closedTrades = [];
    try {
      // Calcola range: da connected_at o ultimi 90 giorni
      const fromMs = connected_at
        ? new Date(connected_at).getTime()
        : Date.now() - 90 * 24 * 60 * 60 * 1000;
      const toMs = Date.now();

      const histRes = await fetch(
        `${baseUrl}/connect/tradingaccounts/${account_id}/deals`
          + `?fromTimestamp=${fromMs}&toTimestamp=${toMs}&limit=500`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Accept': 'application/json',
          },
        }
      );

      if (histRes.ok) {
        const histData = await histRes.json();
        const rawDeals = Array.isArray(histData)
          ? histData
          : (histData.data || histData.deals || []);

        // Raggruppa deals per positionId (ogni posizione ha entry + exit deal)
        const dealMap = {};
        rawDeals.forEach(d => {
          const pid = String(d.positionId || d.id || '');
          if (!dealMap[pid]) dealMap[pid] = { entry: null, exit: null };
          if (d.dealType === 'DEAL_TYPE_ENTRY' || !dealMap[pid].entry) {
            dealMap[pid].entry = d;
          } else {
            dealMap[pid].exit = d;
          }
        });

        closedTrades = Object.values(dealMap)
          .filter(g => g.exit) // solo trade completati
          .map(g => {
            const e = g.entry, x = g.exit;
            const openTs  = e.executionTimestamp || e.createTimestamp;
            const closeTs = x.executionTimestamp || x.createTimestamp;

            // Filtra per connected_at (solo trade aperti dopo la connessione)
            if (connected_at && openTs && new Date(openTs) < new Date(connected_at)) {
              return null;
            }

            return {
              external_id:  String(e.positionId || e.id || ''),
              platform:     'ctrader',
              symbol:       e.symbolName || e.symbol || '',
              direction:    (e.tradeSide || '').toUpperCase() === 'BUY' ? 'buy' : 'sell',
              volume:       (e.volume || 0) / 100000,
              lots:         (e.volume || 0) / 100000,
              open_price:   e.executionPrice || 0,
              close_price:  x.executionPrice || 0,
              stop_loss:    null,
              take_profit:  null,
              profit:       ((x.grossProfit || 0) + (x.swap || 0) + (x.commission || 0)) / 100,
              pnl_realized: ((x.grossProfit || 0) + (x.swap || 0) + (x.commission || 0)) / 100,
              swap:         (x.swap || 0) / 100,
              commission:   ((e.commission || 0) + (x.commission || 0)) / 100,
              status:       'closed',
              open_time:    openTs  ? new Date(openTs).toISOString()  : null,
              close_time:   closeTs ? new Date(closeTs).toISOString() : null,
              opened_at:    openTs  ? new Date(openTs).toISOString()  : null,
              closed_at:    closeTs ? new Date(closeTs).toISOString() : null,
              comment:      e.comment || '',
            };
          })
          .filter(Boolean);
      }
    } catch (histErr) {
      console.warn('Storico trade non disponibile:', histErr.message);
    }

    return res.status(200).json({
      positions,
      closed: closedTrades,
      total:  positions.length + closedTrades.length,
    });

  } catch (err) {
    console.error('ctrader-positions error:', err);
    return res.status(500).json({ error: err.message });
  }
}
