// api/market-data.js
// Proxy server-side per dati mercati — niente CORS

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    var results = {};

    // ── FOREX via Frankfurter ─────────────────────────────────
    try {
      var today = new Date().toISOString().slice(0,10);
      var prev  = new Date(Date.now() - 3*86400000).toISOString().slice(0,10);
      var week  = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
      var month = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);

      var [rT, rP, rW, rM] = await Promise.all([
        fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,AUD,CHF,CAD,NZD,MXN,SGD,NOK,SEK,DKK').then(r=>r.json()),
        fetch('https://api.frankfurter.app/'+prev+'?from=USD&to=EUR,GBP,JPY,AUD,CHF,CAD,NZD,MXN,SGD,NOK,SEK,DKK').then(r=>r.json()),
        fetch('https://api.frankfurter.app/'+week+'?from=USD&to=EUR,GBP,JPY,AUD,CHF,CAD,NZD,MXN,SGD,NOK,SEK,DKK').then(r=>r.json()),
        fetch('https://api.frankfurter.app/'+month+'?from=USD&to=EUR,GBP,JPY,AUD,CHF,CAD,NZD,MXN,SGD,NOK,SEK,DKK').then(r=>r.json()),
      ]);

      var t = rT.rates||{}, p = rP.rates||{}, w = rW.rates||{}, m = rM.rates||{};

      function cross(base, quote) {
        var price = base==='USD' ? t[quote] : quote==='USD' ? 1/t[base] : t[quote]/t[base];
        var pp    = base==='USD' ? p[quote] : quote==='USD' ? 1/p[base] : p[quote]/p[base];
        var wp    = base==='USD' ? w[quote] : quote==='USD' ? 1/w[base] : w[quote]/w[base];
        var mp    = base==='USD' ? m[quote] : quote==='USD' ? 1/m[base] : m[quote]/m[base];
        return {
          price: price,
          pct1d: pp ? ((price-pp)/pp)*100 : null,
          pct1w: wp ? ((price-wp)/wp)*100 : null,
          pct1m: mp ? ((price-mp)/mp)*100 : null
        };
      }

      results.forex = {
        'EUR/USD': cross('EUR','USD'), 'GBP/USD': cross('GBP','USD'),
        'USD/JPY': cross('USD','JPY'), 'AUD/USD': cross('AUD','USD'),
        'USD/CHF': cross('USD','CHF'), 'USD/CAD': cross('USD','CAD'),
        'NZD/USD': cross('NZD','USD'), 'EUR/JPY': cross('EUR','JPY'),
        'EUR/GBP': cross('EUR','GBP'), 'GBP/JPY': cross('GBP','JPY'),
        'EUR/CHF': cross('EUR','CHF'), 'AUD/JPY': cross('AUD','JPY'),
        'USD/MXN': cross('USD','MXN'), 'USD/NOK': cross('USD','NOK'),
      };
    } catch(e) { results.forex = {}; }

    // ── CRYPTO via CoinGecko ──────────────────────────────────
    try {
      var ids = 'bitcoin,ethereum,solana,binancecoin,ripple,cardano,dogecoin,avalanche-2';
      var cr = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids='+ids+
        '&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_30d_change=true'
      ).then(r=>r.json());

      var cryptoMap = {
        'bitcoin':'BTC/USD','ethereum':'ETH/USD','solana':'SOL/USD',
        'binancecoin':'BNB/USD','ripple':'XRP/USD','cardano':'ADA/USD',
        'dogecoin':'DOGE/USD','avalanche-2':'AVAX/USD'
      };
      results.crypto = {};
      Object.keys(cryptoMap).forEach(function(id) {
        if (!cr[id]) return;
        results.crypto[cryptoMap[id]] = {
          price: cr[id].usd,
          pct1d: cr[id].usd_24h_change||null,
          pct1w: cr[id].usd_7d_change||null,
          pct1m: cr[id].usd_30d_change||null
        };
      });
    } catch(e) { results.crypto = {}; }

    // ── INDICI + MATERIE PRIME via Yahoo Finance ──────────────
    try {
      var syms = ['^GSPC','^NDX','^DJI','^GDAXI','^FTSE','^FCHI','^N225','^VIX',
                  'GC=F','SI=F','CL=F','BZ=F','NG=F','HG=F','PL=F','ZW=F','ZC=F','KC=F'];
      var yhResp = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/quote?symbols=' + encodeURIComponent(syms.join(',')) +
        '&fields=regularMarketPrice,regularMarketChangePercent,marketState',
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      ).then(r=>r.json());

      var yhResults = (yhResp.quoteResponse||{}).result || [];
      var nameMap = {
        '^GSPC':'S&P 500','^NDX':'Nasdaq','^DJI':'Dow Jones','^GDAXI':'DAX 40',
        '^FTSE':'FTSE 100','^FCHI':'CAC 40','^N225':'Nikkei','^VIX':'VIX',
        'GC=F':'XAU/USD','SI=F':'XAG/USD','CL=F':'WTI Oil','BZ=F':'Brent',
        'NG=F':'Nat Gas','HG=F':'Copper','PL=F':'Platinum','ZW=F':'Wheat',
        'ZC=F':'Corn','KC=F':'Coffee'
      };

      results.indices = {}; results.commod = {};
      yhResults.forEach(function(q) {
        var name = nameMap[q.symbol];
        if (!name) return;
        var data = {
          price: q.regularMarketPrice,
          pct1d: q.regularMarketChangePercent||null,
          pct1w: null, pct1m: null,
          closed: q.marketState && q.marketState !== 'REGULAR'
        };
        if (['^GSPC','^NDX','^DJI','^GDAXI','^FTSE','^FCHI','^N225','^VIX'].includes(q.symbol)) {
          results.indices[name] = data;
        } else {
          results.commod[name] = data;
        }
      });
    } catch(e) { results.indices = {}; results.commod = {}; }

    res.status(200).json({ success: true, data: results, timestamp: Date.now() });

  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
