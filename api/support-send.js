import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Configurazione CORS per permettere le chiamate dal sito
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  const { ticket_id, message, user, name } = req.body;
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    // 1. LIMITE 9 TICKET: Conta quanti ticket diversi sono stati creati nelle ultime 24 ore
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentMsgs, error: countError } = await sb
      .from('support_messages')
      .select('ticket_id')
      .gt('created_at', yesterday);

    if (countError) throw countError;

    // Estraiamo la lista dei Ticket ID univoci
    const activeTickets = [...new Set(recentMsgs.map(m => m.ticket_id))];

    // Se abbiamo già 9 ticket e quello attuale NON è tra quelli (è nuovo), blocchiamo
    if (activeTickets.length >= 9 && !activeTickets.includes(ticket_id)) {
      return res.status(429).json({ 
        error: 'Tutti i nostri 9 operatori sono attualmente impegnati in altre chat. Riprova tra qualche ora.' 
      });
    }

    // 2. INVIO A TELEGRAM
    const BOT_TOKEN = '8753887928:AAHg-HQU06rJ90qiqPpt0n5_F3m24mmxXXA';
    const CHAT_ID = '998979042';

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message // Il messaggio arriva già formattato dal sito con il Ticket ID
      })
    });

    if (!tgRes.ok) throw new Error('Errore invio Telegram');

    // 3. SALVATAGGIO SU SUPABASE (Messaggio utente)
    // Se il messaggio è quello di apertura (contiene 🔴), lo salviamo come info utente
    await sb.from('support_messages').insert({
      ticket_id,
      sender: 'user',
      text: message,
      operator_msg: false,
      role: 'user',    // Per compatibilità vecchia struttura
      content: message // Per compatibilità vecchia struttura
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
