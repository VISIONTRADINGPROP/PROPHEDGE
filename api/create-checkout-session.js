import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { plan, email } = req.body;
  
  const priceId = plan === 'monthly' 
    ? process.env.STRIPE_PRICE_MONTHLY 
    : process.env.STRIPE_PRICE_YEARLY;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      phone_number_collection: { enabled: true },
      success_url: process.env.APP_URL + '/?stripe_success=1&plan=' + plan,
      cancel_url: process.env.APP_URL + '/?stripe_cancel=1',
      locale: 'it',
    });
    res.json({ url: session.url });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
