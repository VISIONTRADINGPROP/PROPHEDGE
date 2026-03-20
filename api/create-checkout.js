// api/create-checkout.js
// Vercel Serverless Function
// Crea una sessione Stripe Checkout per licenza a vita (pagamento unico)
const Stripe = require('stripe');
module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const { email, user_id } = req.body;
    if (!email || !user_id) {
      return res.status(400).json({ error: 'email e user_id richiesti' });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'PropHedge — Licenza a vita',
            description: 'Accesso permanente a PropHedge. Pagamento unico. VISIONTRADING.',
            images: [],
          },
          unit_amount: 120000, // €1.200,00 in centesimi
        },
        quantity: 1,
      }],
      metadata: {
        user_id: user_id,
        product: 'prophedge_lifetime',
      },
      success_url: process.env.APP_URL + '/app?payment=success',
      cancel_url:  process.env.APP_URL + '/?payment=cancelled',
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Errore interno. Riprova.' });
  }
};
