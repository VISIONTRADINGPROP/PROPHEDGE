module.exports = async function handler(req, res) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(200).json({
      status: 'ERRORE',
      problema: 'Variabili mancanti su Vercel',
      BOT_TOKEN: !!BOT_TOKEN,
      CHAT_ID: !!CHAT_ID
    });
  }

  try {
    const r = await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: 'TEST PropHedge - funziona!'
      })
    });
    const d = await r.json();
    return res.status(200).json({
      telegram_ok: d.ok,
      errore: d.description || null,
      chat_id_usato: CHAT_ID
    });
  } catch(e) {
    return res.status(200).json({
      status: 'ERRORE_RETE',
      errore: e.message
    });
  }
};
