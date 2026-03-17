// api/check-license.js
// Verifica che l'utente abbia una licenza valida
// Chiamata dalla pagina di login e dall'app

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { user_id, token } = req.body;
    if (!user_id || !token) {
      return res.status(400).json({ valid: false, reason: 'missing_params' });
    }

    // Usa il token dell'utente per verificare la sessione (sicuro)
    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user || user.id !== user_id) {
      return res.status(200).json({ valid: false, reason: 'invalid_session' });
    }

    // Controlla license_end nei metadati utente
    const meta = user.user_metadata || {};
    const licenseEnd = meta.license_end;

    if (!licenseEnd) {
      return res.status(200).json({ valid: false, reason: 'no_license' });
    }

    const now = new Date();
    const end = new Date(licenseEnd);

    if (now > end) {
      return res.status(200).json({
        valid: false,
        reason: 'expired',
        expired_at: licenseEnd
      });
    }

    // Licenza valida
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return res.status(200).json({
      valid: true,
      expires: licenseEnd,
      days_left: daysLeft
    });

  } catch (err) {
    console.error('check-license error:', err.message);
    res.status(500).json({ valid: false, reason: 'server_error' });
  }
};
