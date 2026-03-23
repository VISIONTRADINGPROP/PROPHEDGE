// api/support-messages.js
// Posiziona questo file in: /api/support-messages.js su Vercel

// Questo endpoint viene interrogato dal frontend ogni 5 secondi.
// Legge gli aggiornamenti dal bot Telegram tramite getUpdates
// e restituisce solo le risposte inviate da te (operatore).

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  const TELEGRAM_BOT_TOKEN = '8753887928:AAHg-HQU06rJ90qiqPpt0n5_F3m24mmxXXA';
  const OPERATOR_CHAT_ID   = '998979042'; // il tuo chat ID Telegram

  try {
    const { after } = req.query;
    const afterDate = after ? new Date(after) : null;

    // Recupera gli ultimi aggiornamenti dal bot
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=50&allowed_updates=["message"]`;
    const tgRes  = await fetch(url);
    const tgData = await tgRes.json();

    if (!tgData.ok) {
      return res.status(500).json({ error: 'Errore Telegram', details: tgData });
    }

    // Filtra: solo i messaggi che TU hai scritto nel bot
    // (mittente = il tuo chat_id, non il bot stesso)
    const messages = (tgData.result || [])
      .filter(update => {
        const msg = update.message;
        if (!msg) return false;
        // Il messaggio deve venire dal tuo account (operatore)
        if (String(msg.chat.id) !== String(OPERATOR_CHAT_ID)) return false;
        // Esclude messaggi vuoti
        if (!msg.text) return false;
        // Filtra per data se richiesto
        if (afterDate) {
          const msgDate = new Date(msg.date * 1000);
          if (msgDate <= afterDate) return false;
        }
        return true;
      })
      .map(update => ({
        id:         update.update_id,
        content:    update.message.text,
        created_at: new Date(update.message.date * 1000).toISOString(),
        from:       update.message.from?.first_name || 'Operatore'
      }));

    return res.status(200).json({ messages });

  } catch (err) {
    console.error('support-messages error:', err);
    return res.status(500).json({ error: 'Errore interno', details: err.message });
  }
}
