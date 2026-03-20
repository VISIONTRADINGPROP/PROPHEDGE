const { createClient } = require('@supabase/supabase-js');
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const { user_id, token } = req.body;
    if (!user_id || !token) {
      return res.status(400).json({ valid: false, reason: 'missing_params' });
    }
    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user || user.id !== user_id) {
      return res.status(200).json({ valid: false, reason: 'invalid_session' });
    }
    const meta = user.user_metadata || {};
    const licenseStart = meta.license_start;
    const licenseEnd = meta.license_end;
    const licenseType = meta.license_type;

    // Nessuna licenza attivata
    if (!licenseStart) {
      return res.status(200).json({ valid: false, reason: 'no_license' });
    }

    // Licenza a vita: license_end è null oppure license_type è 'lifetime'
    if (licenseType === 'lifetime' || licenseEnd === null || licenseEnd === undefined) {
      return res.status(200).json({ valid: true, license_type: 'lifetime', expires: null, days_left: null });
    }

    // Licenza con scadenza (vecchi utenti)
    const now = new Date();
    const end = new Date(licenseEnd);
    if (now > end) {
      return res.status(200).json({ valid: false, reason: 'expired', expired_at: licenseEnd });
    }
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return res.status(200).json({ valid: true, license_type: 'annual', expires: licenseEnd, days_left: daysLeft });
  } catch (err) {
    console.error('check-license error:', err.message);
    res.status(500).json({ valid: false, reason: 'server_error' });
  }
};
