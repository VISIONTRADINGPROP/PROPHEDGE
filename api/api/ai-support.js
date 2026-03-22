// /api/ai-support.js
// Proxy sicuro verso Anthropic API — la chiave non viene mai esposta al client

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurata' });
  }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array richiesto' });
  }

  const SYSTEM = `Sei l'assistente AI ufficiale di PropHedge — software italiano per trader di prop firm sviluppato da VisionTrading.

COSA SAI FARE:
Rispondi a qualsiasi domanda sul software PropHedge in modo dettagliato e pratico, passo per passo.

FUNZIONALITÀ DEL SOFTWARE:
- Dashboard: mostra tutte le sfide attive con P&L reale, lotti calcolati, scenario A e B
- Nuova Sfida: inserisci parametri prop firm (dimensione, DD%, giorni, payout%) e calcola automaticamente lotti hedge ottimali
- Calcolo Hedge: strategia Prop+Personale o Prop+Prop. Scenario A = prop chiusa (hedge incassa). Scenario B = payout ricevuto
- Journal: traccia tutti i trade dal momento della connessione broker/prop. Mostra aperti/chiusi, P&L, equity curve
- Connessione MT4/MT5: tramite Expert Advisor (EA) scaricabile dalla tab EA Download. Parametri: Email + API Key + Journal ID
- Connessione cTrader: tramite OAuth (quando app approvata) o Token manuale dal Sandbox Spotware
- Mercati Live: Forex aggiornato ogni 5s (Frankfurter BCE), Crypto tick-by-tick (Binance WebSocket), Indici/Materie prime ogni 30s (Yahoo Finance)
- Calendario Economico: dati ForexFactory con impatto rosso/giallo/arancione, countdown notizie, alert automatico se notizie rosse entro 2 ore
- Statistiche: equity curve, win rate, profit factor, avg win/loss per tutte le sfide
- Supporto: chat AI (sei tu!) + contatti umani WhatsApp/Email

PROP FIRM SUPPORTATE: FTMO, FundedElite, FTUK, Axi, Pepperstone, IC Markets, City Traders Imperium, Funded Trading Plus, e qualsiasi altra prop firm

COME RISPONDERE:
- Rispondi SEMPRE in italiano
- Sii pratico e specifico — dai istruzioni passo per passo quando richiesto
- Se chiedono come fare qualcosa, spiegalo nei dettagli
- Usa emoji per rendere le risposte più leggibili
- Se la domanda non riguarda PropHedge o il trading con prop firm, di' gentilmente che puoi aiutare solo con il software

SUPPORTO UMANO:
Se l'utente ha un problema che non riesci a risolvere, o chiede esplicitamente di parlare con una persona, rispondi ESATTAMENTE con questo testo (e niente altro dopo):
###HUMAN_SUPPORT###
`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system:     SYSTEM,
        messages:   messages.slice(-10) // ultimi 10 per contesto
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Errore API' });
    }

    const reply = data.content?.[0]?.text || 'Non ho capito, puoi ripetere?';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('ai-support error:', err);
    return res.status(500).json({ error: 'Errore di connessione al servizio AI' });
  }
};
