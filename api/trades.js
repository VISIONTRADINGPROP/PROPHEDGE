// api/ctrader-auth-url.js
// Genera il link OAuth cTrader usando le credenziali del server
// Il cliente non vede mai Client ID e Client Secret

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { env, redirect } = req.query;
  const clientId = process.env.CTRADER_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({ error: 'Credenziali cTrader non configurate sul server' });
  }

  const authBase = env === 'live'
    ? 'https://connect.ctrader.com/oauth/authorize'
    : 'https://id.ctrader.com/oauth2/auth';

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirect || (process.env.APP_URL + '/ctrader-callback'),
    scope:         'trading',
    state:         'prophedge'
  });

  res.status(200).json({ url: authBase + '?' + params.toString() });
};
