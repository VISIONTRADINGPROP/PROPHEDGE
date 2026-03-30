const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const body = req.body;
  if (!body || !body.message) return res.status(200).send('OK');

  const msg = body.message;
  const text = msg.text || '';
  const replyTo = msg.reply_to_message;
  const chatId = msg.chat.id;

  const BOT_TOKEN = '8753887928:AAHg-HQU06rJ90qiqPpt0n5_F3m24mmxXXA';

  const sendDebug = async (messaggio) => {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: messaggio })
      });
    } catch(e) {}
  };

  // Se è un comando, ignora
  if (text.startsWith('/')) return res.status(200).send('OK');

  // Se non si usa "Rispondi"
  if (!replyTo) {
    await sendDebug("⚠️ ERRORE: Devi usare la funzione 'Rispondi' sul messaggio del ticket.");
    return res.status(200).send('OK');
  }

  const originalText = replyTo.text || '';
  const ticketMatch = originalText.match(/TICKET:\s*([A-Za-z0-9_-]+)/);

  if (!ticketMatch) {
    await sendDebug("⚠️ ERRORE: Il messaggio originale non contiene il codice del Ticket.");
    return res.status(200).send('OK');
  }

  const ticketId = ticketMatch[1];

  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    
    const { error } = await sb.from('support_messages').insert({
      ticket_id: ticketId,
      sender: 'support',
      text: text,
      operator_msg: true,
      created_at: new Date().toISOString()
    });

    if (error) {
      await sendDebug(`❌ Errore Database Supabase: ${error.message}`);
    } else {
      await sendDebug(`✅ Perfetto! Risposta inviata alla chat per il ticket ${ticketId}.`);
    }
  } catch(e) {
    await sendDebug(`❌ Errore Vercel: ${e.message}`);
  }

  res.status(200).send('OK');
};
