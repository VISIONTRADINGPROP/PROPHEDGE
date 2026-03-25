import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(Buffer.from(data)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch(err) {
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email;
    const subscriptionId = session.subscription;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0].price.id;
    const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const plan = priceId === process.env.STRIPE_PRICE_MONTHLY ? 'monthly' : 'yearly';

    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);

    if (user) {
      await supabase.from('subscriptions').upsert({
        user_id: user.id,
        email,
        stripe_customer_id: session.customer,
        stripe_subscription_id: subscriptionId,
        plan,
        status: 'active',
        current_period_end: periodEnd,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          subscription_status: 'active',
          subscription_plan: plan,
          subscription_end: periodEnd
        }
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    await supabase.from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.id);
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    await supabase.from('subscriptions')
      .update({ status: 'past_due', updated_at: new Date().toISOString() })
      .eq('stripe_customer_id', invoice.customer);
  }

  res.json({ received: true });
}
