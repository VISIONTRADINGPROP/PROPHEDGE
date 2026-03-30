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

  // I tuoi Token originali
  const TELEGRAM_BOT_TOKEN = '8753887928:AAHg-HQU06rJ90qiqPpt0n5_F3m24mmxXXA';
  const TELEGRAM_CHAT_ID   = '998979042';

  try {
    // FIX 1: Accetta tutti i formati (sia vecchi che nuovi) per non perdere i dati
    const ticket_id  = req.body.ticket_id || 'N/D';
    const message    = req.body.message || '';
    const user_email = req.body.user_email || req.body.user || req.body.email || 'N/D';
    const user_name  = req.body.user_name || req.body.name || 'Sconosciuto';

    if (!message) {
      return res.status(400).json({ error: 'Messaggio mancante' });
    }

    // FIX 2: NIENTE Markdown. Testo pulito per evitare crash su caratteri speciali (_ o *)
    // Questa struttura è perfetta per far funzionare il tuo webhook!
    const telegramText = 
      `🔴 RICHIESTA SUPPORTO LIVE\n\n` +
      `👤 Utente: ${user_name}\n` +
      `📧 Email: ${user_email}\n` +
      `🎫 TICKET: ${ticket_id}\n\n` +
      `💬 Messaggio:\n${message}`;

    // Invia a Telegram
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramRes = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: telegramText
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
