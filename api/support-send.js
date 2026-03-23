// api/support-send.js
// Posiziona questo file in: /api/support-send.js su Vercel

export default async function handler(req, res) {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const TELEGRAM_BOT_TOKEN = '8753887928:AAHg-HQU06rJ90qiqPpt0n5_F3m24mmxXXA';
  const TELEGRAM_CHAT_ID   = '998979042';

  try {
    const { ticket_id, message, user_email, user_name } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Messaggio mancante' });
    }

    // Costruisce il messaggio Telegram
    const telegramText =
      `🆕 *NUOVO MESSAGGIO SUPPORTO*\n\n` +
      `👤 *Utente:* ${user_name || 'Sconosciuto'}\n` +
      `📧 *Email:* ${user_email || 'N/D'}\n` +
      `🎫 *Ticket:* \`${ticket_id || 'N/D'}\`\n\n` +
      `💬 *Messaggio:*\n${message}`;

    // Invia a Telegram
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramRes = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: telegramText,
        parse_mode: 'Markdown'
      })
    });

    const telegramData = await telegramRes.json();

    if (!telegramData.ok) {
      console.error('Telegram error:', telegramData);
      return res.status(500).json({ error: 'Errore invio Telegram', details: telegramData });
    }

    return res.status(200).json({ success: true, telegram_message_id: telegramData.result.message_id });

  } catch (err) {
    console.error('support-send error:', err);
    return res.status(500).json({ error: 'Errore interno', details: err.message });
  }
}
