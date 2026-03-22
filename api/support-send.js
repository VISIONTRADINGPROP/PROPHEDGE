// /api/support-send.js
// Cliente invia messaggio → arriva su Telegram come notifica

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).end();

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ error: 'Telegram non configurato' });
  }

  const { ticket_id, message, user_email, user_name } = req.body || {};
  if (!message || !ticket_id) return res.status(400).json({ error: 'Dati mancanti' });

  // Formatta il messaggio per Telegram
  const text = [
    '🆘 *NUOVO MESSAGGIO SUPPORTO*',
    '',
    `👤 *Cliente:* ${user_name || 'Utente'} ${user_email ? '('+user_email+')' : ''}`,
    `💬 *Messaggio:*`,
    message,
    '',
    `🎫 TICKET: ${ticket_id}`,
    '',
    '_Rispondi a questo messaggio per rispondere al cliente_'
  ].join('\n');

  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:    CHAT_ID,
          text:       text,
          parse_mode: 'Markdown'
        })
      }
    );
    const data = await r.json();
    if (!data.ok) return res.status(500).json({ error: data.description });
    return res.status(200).json({ ok: true, message_id: data.result.message_id });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
