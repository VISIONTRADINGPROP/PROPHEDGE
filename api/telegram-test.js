// /api/telegram-test.js
// Apri nel browser: https://tuosito.vercel.app/api/telegram-test
// Ti dirà esattamente cosa non va
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
  
  const debug = {
    has_token: !!BOT_TOKEN,
    token_length: BOT_TOKEN ? BOT_TOKEN.length : 0,
    token_preview: BOT_TOKEN ? BOT_TOKEN.slice(0,10)+'...' : 'MANCANTE',
    chat_id: CHAT_ID || 'MANCANTE',
  };
  
  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(200).json({ 
      status: 'ERRORE', 
      messaggio: 'Variabili ambiente mancanti su Vercel',
      debug 
    });
  }
  
  try {
    // Test 1: verifica bot
    const botRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const botData = await botRes.json();
    
    if (!botData.ok) {
      return res.status(200).json({ 
        status: 'TOKEN_INVALIDO', 
        messaggio: 'Il token Telegram non funziona. Rigeneralo con /revoke su @BotFather',
        telegram_error: botData.description,
        debug
      });
    }
    
    // Test 2: invia messaggio di test
    const msgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: '✅ TEST PropHedge Support - tutto funziona!'
      })
    });
    const msgData = await msgRes.json();
    
    if (!msgData.ok) {
      return res.status(200).json({
        status: 'CHAT_ID_ERRATO',
        messaggio: 'Il bot funziona ma non riesce a inviare. Chat ID sbagliato o bot bloccato.',
        telegram_error: msgData.description,
        bot_name: botData.result?.username,
        debug
      });
    }
    
    return res.status(200).json({
      status: 'OK',
      messaggio: 'Tutto funziona! Controlla Telegram, hai ricevuto il messaggio di test.',
      bot_name: botData.result?.username,
      debug
    });
    
  } catch(e) {
    return res.status(200).json({ status: 'ERRORE_RETE', messaggio: e.message, debug });
  }
};
