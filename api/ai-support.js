// /api/ai-support.js — usa Groq (gratuito)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method === 'GET') return res.status(200).json({ status: 'ok', hasKey: !!process.env.GROQ_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY non configurata' });

  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages) || !messages.length)
    return res.status(400).json({ error: 'messages richiesto' });

  const SYSTEM = `Sei l'assistente AI di PropHedge, software italiano per trader di prop firm sviluppato da VisionTrading.
Rispondi SEMPRE in italiano, in modo pratico con istruzioni passo per passo numerate.

FUNZIONI:
- Dashboard: sfide attive, P&L reale, lotti, scenario A (prop chiusa) e B (payout incassato)
- Nuova Sfida: inserisci dimensione conto, DD%, giorni, payout% e calcola lotti hedge automaticamente
- Journal: traccia trade dal momento connessione, mostra aperti/chiusi, P&L, equity curve
- MT4/MT5: scarica EA dalla tab "EA Download", inserisci Email + API Key + Journal ID nei parametri EA
- cTrader: vai su connect.spotware.com/apps/23386/playground, ottieni token, incollalo nel dialog Connetti
- Mercati Live: Forex aggiorna ogni 5s, Crypto tick Binance WebSocket, Indici ogni 30s Yahoo
- Calendario: ForexFactory, alert notizie rosse entro 2 ore, countdown
- Prop firm supportate: FTMO, FundedElite, FTUK, Axi, Pepperstone, IC Markets, City Traders e altre

Se non riguarda PropHedge declina gentilmente.
Se chiedono supporto umano rispondi SOLO: ###HUMAN_SUPPORT###`;

  // Aggiungi system come primo messaggio user se necessario (Groq supporta system nativo)
  const payload = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM },
      ...messages.slice(-10)
    ],
    max_tokens: 800,
    temperature: 0.7
  };

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    console.log('Groq status:', r.status);

    if (!r.ok) {
      console.error('Groq error:', JSON.stringify(data));
      return res.status(r.status).json({ error: data.error?.message || 'Errore Groq API' });
    }

    const reply = data.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ error: 'Risposta vuota' });

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('ai-support error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
