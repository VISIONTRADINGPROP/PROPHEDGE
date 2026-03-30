// /api/telegram-webhook.js

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(200).end(); return; }

  const body = req.body;
  if (!body || !body.message) { res.status(200).end(); return; }

  const msg     = body.message;
  const text    = msg.text || '';
  const replyTo = msg.reply_to_message;

  // Ignora i comandi come /start
  if (text.startsWith('/')) { res.status(200).end(); return; }

  // Se non stai usando la funzione "Rispondi" di Telegram, blocca tutto
  if (!replyTo) { res.status(200).end(); return; }

  const originalText = replyTo.text || '';
  
  // 🔥 FIX DEFINITIVO: Cerca SOLO "TKT-" seguito da numeri. Ignora emoji, spazi e formattazioni!
  const ticketMatch  = originalText.match(/(TKT-\d+)/);
  if (!ticketMatch) { res.status(200).end(); return; }

  const ticketId = ticketMatch[1];

  // Scrive la risposta su Supabase
  try {
    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    await sb.from('support_messages').insert({
      ticket_id:    ticketId,
      sender:       'support',
      text:         text,
      operator_msg: true,
      created_at:   new Date().toISOString()
    });
  } catch(e) {
    console.error('Errore webhook:', e.message);
  }

  res.status(200).json({ ok: true });
};
