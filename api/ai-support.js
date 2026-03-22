// /api/ai-support.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method === 'GET') return res.status(200).json({ status: 'ok', hasKey: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key mancante' });

  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages) || !messages.length)
    return res.status(400).json({ error: 'messages richiesto' });

  const SYSTEM = `Sei l'assistente AI di PropHedge, software per trader di prop firm di VisionTrading.
Rispondi SEMPRE in italiano, in modo pratico e dettagliato con istruzioni passo per passo.

FUNZIONI DEL SOFTWARE:
- Dashboard: sfide attive, P&L reale, lotti, scenario A (prop chiusa) e B (payout)
- Nuova Sfida: inserisci dimensione, DD%, giorni, payout% → calcola lotti hedge
- Journal: trade dal momento connessione, aperti/chiusi, P&L, equity curve
- MT4/MT5: scarica EA da tab "EA Download", inserisci Email + API Key + Journal ID
- cTrader: vai su connect.spotware.com/apps/23386/playground, ottieni token, incollalo nel dialog Connetti
- Mercati Live: Forex ogni 5s, Crypto tick (Binance), Indici ogni 30s
- Calendario: ForexFactory, alert notizie rosse, countdown
- Supporto umano: WhatsApp +39 333 855 3199, Email visiontradingprop@gmail.com

Se l'utente chiede supporto umano rispondi SOLO: ###HUMAN_SUPPORT###`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 800,
        system: SYSTEM,
        messages: messages.slice(-10)
      })
    });

    const data = await r.json();
    console.log('Anthropic status:', r.status, JSON.stringify(data).slice(0, 200));

    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'Errore API' });

    const reply = data.content?.[0]?.text;
    if (!reply) return res.status(500).json({ error: 'Risposta vuota da API' });

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('ai-support error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
