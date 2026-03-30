// api/support-send.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ticket_id, message, user_email, user_name } = req.body;
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    // 1. CONTEGGIO TICKET ATTIVI (Ultime 24 ore)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: activeTickets } = await sb
      .from('support_messages')
      .select('ticket_id')
      .gt('created_at', yesterday);

    // Estraiamo i ticket unici
    const uniqueTickets = [...new Set(activeTickets.map(t => t.ticket_id))];

    // 2. BLOCCO SE > 9 (tranne se il ticket esiste già nella conversazione attuale)
    if (uniqueTickets.length >= 9 && !uniqueTickets.includes(ticket_id)) {
      return res.status(429).json({ 
        error: 'Tutti gli operatori sono occupati. Massimo 9 ticket attivi raggiunti. Riprova più tardi.' 
      });
    }

    // 3. INVIO A TELEGRAM (senza Markdown per evitare crash)
    const TELEGRAM_BOT_TOKEN = '8753887928:AAHg-HQU06rJ90qiqPpt0n5_F3m24mmxXXA';
    const TELEGRAM_CHAT_ID   = '998979042';

    const telegramText = 
      `🆕 NUOVO MESSAGGIO\n` +
      `👤 Utente: ${user_name || 'Sconosciuto'}\n` +
      `📧 Email: ${user_email || 'N/D'}\n` +
      `🎫 TICKET: ${ticket_id}\n\n` +
      `💬 Messaggio:\n${message}`;

    const telegramRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: telegramText })
    });

    // 4. SALVATAGGIO MESSAGGIO UTENTE SU SUPABASE
    await sb.from('support_messages').insert({
      ticket_id,
      sender: 'user',
      text: message,
      operator_msg: false
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
