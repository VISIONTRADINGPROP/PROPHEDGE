// /api/telegram-webhook.js

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { return res.status(200).end(); }

  const body = req.body;
  if (!body || !body.message) { return res.status(200).end(); }

  const msg     = body.message;
  const text    = msg.text || '';
  const replyTo = msg.reply_to_message;

  // Ignora i comandi come /start
  if (text.startsWith('/')) { return res.status(200).end(); }

  // Se non stai usando la funzione "Rispondi" di Telegram, blocca tutto
  if (!replyTo) { return res.status(200).end(); }

  const originalText = replyTo.text || '';
  
  // 🔥 FIX DEFINITIVO: Cerca la parola "TICKET:" e cattura QUALSIASI codice ci sia dopo, 
  // che sia TKT-123 o T1711800_A1B2
  const ticketMatch  = originalText.match(/TICKET:\s*([A-Za-z0-9_-]+)/);
  if (!ticketMatch) { return res.status(200).end(); }

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
