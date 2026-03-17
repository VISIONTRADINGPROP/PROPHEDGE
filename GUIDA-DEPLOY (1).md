# GUIDA DEPLOY PROPHEDGE SU VERCEL
# Segui questi passi nell'ordine — richiede circa 30 minuti

## PASSO 1 — Supabase (già attivo)

Vai su https://supabase.com → apri il tuo progetto → Settings → API
Copia la "service_role key" (NON la anon key — quella inizia con eyJ...)
Tienila da parte per il Passo 4.


## PASSO 2 — Crea account Stripe

1. Vai su https://stripe.com → crea account
2. Vai su Developers → API keys
3. Copia la "Secret key" (inizia con sk_live_...)
4. Tienila da parte per il Passo 4.


## PASSO 3 — Carica il progetto su GitHub

1. Vai su https://github.com → crea un account se non ce l'hai
2. Crea un nuovo repository → chiamalo "prophedge"
3. Carica TUTTI i file di questa cartella nel repository
   (trascina i file nella pagina GitHub oppure usa GitHub Desktop)


## PASSO 4 — Deploy su Vercel

1. Vai su https://vercel.com → registrati con il tuo account GitHub
2. Clicca "New Project" → importa il repository "prophedge"
3. Prima di cliccare Deploy, aggiungi le variabili d'ambiente:
   Clicca "Environment Variables" e inserisci:

   SUPABASE_URL         = https://kvvrvhkomdpdikohvcsv.supabase.co
   SUPABASE_ANON_KEY    = sb_publishable_289bMctZ8BjEG_gZn5dJ5A_7aJZRjpx
   SUPABASE_SERVICE_KEY = [la service_role key di Supabase]
   STRIPE_SECRET_KEY    = [la secret key di Stripe]
   STRIPE_WEBHOOK_SECRET = [vedi Passo 5]
   APP_URL              = https://[nome-progetto].vercel.app

4. Clicca Deploy → attendi 2-3 minuti
5. Vercel ti darà un URL tipo: https://prophedge-xxx.vercel.app
   Quello è il tuo sito!


## PASSO 5 — Configura il Webhook Stripe

Questo è fondamentale: Stripe deve avvisare il tuo sito quando qualcuno paga.

1. Vai su dashboard.stripe.com → Developers → Webhooks
2. Clicca "Add endpoint"
3. URL endpoint: https://[il-tuo-url-vercel]/api/stripe-webhook
4. Seleziona evento: checkout.session.completed
5. Clicca "Add endpoint"
6. Copia il "Signing secret" (inizia con whsec_...)
7. Torna su Vercel → Settings → Environment Variables
8. Aggiungi: STRIPE_WEBHOOK_SECRET = [il signing secret]
9. Fai un nuovo deploy (Vercel → Deployments → Redeploy)


## PASSO 6 — Test finale

1. Vai sul tuo sito Vercel
2. Clicca "Acquista" → inserisci dati
3. Stripe aprirà la pagina di pagamento
4. Usa la carta di test: 4242 4242 4242 4242 / 12/26 / 123
5. Dopo il pagamento dovresti essere reindirizzato all'app
6. La licenza sarà attiva per 365 giorni


## DOMINIO PERSONALIZZATO (opzionale)

Se in futuro compri un dominio (es. app.visiontrading.it):
1. Vercel → il tuo progetto → Settings → Domains
2. Aggiungi il dominio e segui le istruzioni DNS


## SUPPORTO

Per qualsiasi problema scrivi a Claude con il messaggio di errore esatto.
