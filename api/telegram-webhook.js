// /api/telegram-webhook.js
// Riceve risposte da Telegram e le inoltra al cliente via Supabase

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(200).end(); return; }

  const body = req.body;
  if (!body || !body.message) { res.status(200).end(); return; }

  const msg     = body.message;
  const text    = msg.text || '';
  const from    = msg.from?.first_name || 'Supporto';
  const replyTo = msg.reply_to_message;

  // Ignora comandi
  if (text.startsWith('/')) { res.status(200).end(); return; }

  // Deve essere una risposta a un messaggio (per sapere a quale ticket rispondere)
  if (!replyTo) {
    // Messaggio diretto — ignora o invia istruzioni
    res.status(200).end();
    return;
  }

  // Estrai ticket_id dal testo del messaggio originale
  // Formato messaggio originale: "...\n\n🎫 TICKET: ticket_id_xxx"
  const originalText = replyTo.text || '';
  const ticketMatch  = originalText.match(/🎫 TICKET: ([\w-]+)/);
  if (!ticketMatch) { res.status(200).end(); return; }

  const ticketId = ticketMatch[1];

  // Salva risposta su Supabase
  try {
    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    await sb.from('support_messages').insert({
      ticket_id:  ticketId,
      role:       'support',
      content:    text,
      created_at: new Date().toISOString()
    });
  } catch(e) {
    console.error('telegram-webhook supabase error:', e.message);
  }

  res.status(200).json({ ok: true });
};
