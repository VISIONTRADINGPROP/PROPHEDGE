// /api/ai-support.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // GET: test che l'endpoint funzioni
  if (req.method === 'GET') {
    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    return res.status(200).json({
      status: 'ok',
      hasApiKey: hasKey,
      keyPrefix: hasKey ? process.env.ANTHROPIC_API_KEY.slice(0,20)+'...' : 'MISSING'
    });
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'API key non configurata sul server' });
  }

  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array richiesto' });
  }

  const SYSTEM = `Sei l'assistente AI ufficiale di PropHedge — software italiano per trader di prop firm sviluppato da VisionTrading.

FUNZIONALITÀ:
- Dashboard: sfide attive, P&L reale, lotti calcolati, scenari A e B
- Nuova Sfida: parametri prop firm → calcola lotti hedge ottimali
- Hedge: Prop+Personale o Prop+Prop. Scenario A = prop chiusa. Scenario B = payout
- Journal: trade dal momento connessione, aperti/chiusi, P&L, equity curve
- MT4/MT5: EA da EA Download. Parametri: Email + API Key + Journal ID
- cTrader: Token manuale dal Sandbox Spotware
- Mercati Live: Forex, Crypto (Binance WebSocket), Indici/Materie prime
- Calendario: ForexFactory, alert notizie, countdown
- Supporto: WhatsApp +39 333 855 3199, Email visiontradingprop@gmail.com

REGOLE:
- Rispondi SEMPRE in italiano
- Sii pratico, dai istruzioni passo per passo con numeri
- Se l'utente chiede supporto umano scrivi esattamente: ###HUMAN_SUPPORT###`;

  try {
    console.log('Calling Anthropic API...');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM,
        messages: messages.slice(-10)
      })
    });

    const data = await r.json();
    console.log('Anthropic response status:', r.status);

    if (!r.ok) {
      console.error('Anthropic error:', JSON.stringify(data));
      return res.status(r.status).json({ error: data.error?.message || 'Errore Anthropic API' });
    }

    const reply = data.content?.[0]?.text || 'Non ho capito, ripeti.';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('ai-support exception:', err.message);
    return res.status(500).json({ error: 'Errore server: ' + err.message });
  }
};
