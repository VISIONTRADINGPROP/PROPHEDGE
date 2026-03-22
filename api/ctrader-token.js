// api/ctrader-token.js
// Scambia il codice OAuth con access token cTrader

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { code, redirect_uri, env } = req.body;
    if (!code) return res.status(400).json({ error: 'Codice OAuth mancante' });

    const clientId     = process.env.CTRADER_CLIENT_ID;
    const clientSecret = process.env.CTRADER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Credenziali cTrader non configurate' });
    }

    // URL corretto per il token — id.ctrader.com
    const tokenUrl = 'https://id.ctrader.com/oauth2/token';

    const params = new URLSearchParams({
      grant_type:    'authorization_code',
      code:          code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirect_uri || (process.env.APP_URL + '/ctrader-callback')
    });

    const r = await fetch(tokenUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString()
    });

    const data = await r.json();

    if (data.access_token) {
      res.status(200).json({
        access_token:  data.access_token,
        refresh_token: data.refresh_token || null,
        expires_in:    data.expires_in    || 3600
      });
    } else {
      res.status(200).json({
        error: data.error_description || data.error || 'Errore token'
      });
    }
  } catch (err) {
    console.error('ctrader-token error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
