// /api/telegram-webhook.js

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end();

  const body = req.body;
  if (!body || !body.message) return res.status(200).end();

  const msg = body.message;
  const text = msg.text || '';
  const replyTo = msg.reply_to_message;
  const chatId = msg.chat.id;
  
  // Uso il tuo Token per farti arrivare i messaggi di errore diagnostici
  const BOT_TOKEN = '8753887928:AAHg-HQU06rJ90qiqPpt0n5_F3m24mmxXXA';

  // Funzione speciale che ti scrive su Telegram il motivo del blocco
  const sendDebug = async (messaggio) => {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: messaggio })
      });
    } catch(e) {}
  };

  if (text.startsWith('/')) return res.status(200).end();

  if (!replyTo) {
    await sendDebug("⚠️ ERRORE: Non hai usato la funzione 'Rispondi' di Telegram.");
    return res.status(200).end();
  }

  const originalText = replyTo.text || '';
  const ticketMatch = originalText.match(/TICKET:\s*([A-Za-z0-9_-]+)/);

  if (!ticketMatch) {
    await sendDebug("⚠️ ERRORE: Non trovo la parola 'TICKET: ...' nel messaggio originale a cui hai risposto.");
    return res.status(200).end();
  }

  const ticketId = ticketMatch[1];

  try {
    // Controllo se Vercel è collegato a Supabase
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      await sendDebug("❌ ERRORE FATALE: Vercel non riesce a connettersi al Database. Mancano le variabili SUPABASE_URL o SUPABASE_SERVICE_KEY nelle impostazioni di Vercel!");
      return res.status(200).end();
    }

    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Tenta di scrivere nel database
    const { error } = await sb.from('support_messages').insert({
      ticket_id: ticketId,
      sender: 'support',
      text: text,
      operator_msg: true,
      created_at: new Date().toISOString()
    });

    if (error) {
      await sendDebug(`❌ ERRORE DEL DATABASE SUPABASE:\n${error.message}`);
      return res.status(200).end();
    }

    // Se tutto funziona ti dà la conferma verde
    await sendDebug(`✅ Perfetto! Risposta inviata con successo al sito per il ticket ${ticketId}.`);

  } catch(e) {
    await sendDebug(`❌ ERRORE DEL SERVER VERCEL:\n${e.message}`);
  }

  res.status(200).json({ ok: true });
};
