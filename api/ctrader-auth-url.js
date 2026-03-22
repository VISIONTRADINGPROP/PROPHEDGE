// api/ctrader-auth-url.js
// Genera l'URL di autorizzazione OAuth cTrader
// URL corretto: id.ctrader.com (non connect.ctrader.com)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const clientId    = process.env.CTRADER_CLIENT_ID;
  const redirectUri = req.query.redirect || (process.env.APP_URL + '/ctrader-callback');
  const env         = req.query.env || 'live';

  if (!clientId) {
    return res.status(500).json({ error: 'CTRADER_CLIENT_ID non configurato' });
  }

  // Scopes richiesti
  const scope = 'trading';

  // URL corretto cTrader Open API OAuth2
  const authUrl = 'https://id.ctrader.com/oauth/authorize'
    + '?response_type=code'
    + '&client_id='    + encodeURIComponent(clientId)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&scope='        + encodeURIComponent(scope)
    + '&state=prophedge';

  return res.status(200).json({ url: authUrl });
};
