
// /api/ctrader-accounts.js
// Recupera la lista dei conti cTrader associati all'access_token

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token, env } = req.body;

  if (!access_token) {
    return res.status(400).json({ error: 'access_token mancante' });
  }

  // cTrader Open API: Live vs Demo
  const baseUrl = env === 'demo'
    ? 'https://openapi.ctrader.com'
    : 'https://openapi.ctrader.com';

  try {
    const response = await fetch(
      `${baseUrl}/connect/tradingaccounts?token=${access_token}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('cTrader accounts error:', response.status, errText);
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();

    // Normalizza la risposta: data potrebbe essere array diretto o { data: [...] }
    const accounts = Array.isArray(data) ? data : (data.data || data.accounts || []);

    return res.status(200).json({ accounts });
  } catch (err) {
    console.error('ctrader-accounts error:', err);
    return res.status(500).json({ error: err.message });
  }
}
