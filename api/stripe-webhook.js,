// api/stripe-webhook.js
// Riceve l'evento da Stripe quando il pagamento va a buon fine
// Attiva la licenza su Supabase per 365 giorni

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Necessario per leggere il raw body di Stripe
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig    = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send('Webhook error: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const user_id = session.metadata && session.metadata.user_id;
    if (!user_id) { return res.status(200).json({ received: true }); }

    // Calcola date licenza: oggi + 365 giorni
    const now   = new Date();
    const end   = new Date(now);
    end.setFullYear(end.getFullYear() + 1);

    // Aggiorna profilo utente su Supabase con le date licenza
    const sbAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY  // service_role key (NON la publishable)
    );

    const { error } = await sbAdmin.auth.admin.updateUserById(user_id, {
      user_metadata: {
        license_start: now.toISOString(),
        license_end:   end.toISOString(),
        stripe_session: session.id,
      }
    });

    if (error) {
      console.error('Supabase update error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log('Licenza attivata per user:', user_id, '→ scade:', end.toISOString());
  }

  res.status(200).json({ received: true });
};
