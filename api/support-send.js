// /api/support-send.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).end();

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ error: 'Env vars mancanti: TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID' });
  }

  const { ticket_id, message, user_email, user_name, operator } = req.body || {};
  if (!message || !ticket_id) return res.status(400).json({ error: 'Dati mancanti' });

  // Testo SENZA Markdown per evitare errori di parsing con caratteri speciali
  const lines = [
    '🆘 NUOVO MESSAGGIO SUPPORTO',
    '',
    'Cliente: ' + (user_name || 'Utente') + (user_email ? ' (' + user_email + ')' : ''),
    operator ? 'Operatore: ' + operator : '',
    '',
    'Messaggio:',
    message,
    '',
    'TICKET: ' + ticket_id,
    '',
    'Rispondi a questo messaggio per rispondere al cliente'
  ].filter(l => l !== undefined && !(l === '' && lines === undefined));

  const text = lines.join('\n');

  try {
    const r = await fetch(
      'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: String(CHAT_ID).trim(),
          text:    text
          // NO parse_mode - testo semplice, nessun rischio di errori
        })
      }
    );
    const data = await r.json();
    if (!data.ok) {
      return res.status(500).json({ error: data.description, chat_id_used: String(CHAT_ID).trim() });
    }
    return res.status(200).json({ ok: true });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
