//+------------------------------------------------------------------+
//|                                           PropHedge_EA.mq4       |
//|                              PropHedge - VISIONTRADING           |
//|                                                                   |
//| SETUP INIZIALE (una volta sola):                                  |
//|                                                                   |
//| STEP 1 — Copia il file                                           |
//|   MT4: File → Open Data Folder → MQL4 → Experts                 |
//|   MT5: File → Open Data Folder → MQL5 → Experts                 |
//|   Incolla PropHedge_EA.mq4 nella cartella e riavvia MT4/MT5      |
//|                                                                   |
//| STEP 2 — Abilita WebRequest                                       |
//|   Strumenti → Opzioni → Expert Advisor                           |
//|   Spunta: "Consenti WebRequest per i seguenti URL"               |
//|   Aggiungi: https://prophedge-iota.vercel.app                   |
//|   Clicca OK                                                       |
//|                                                                   |
//| STEP 3 — Prima configurazione                                     |
//|   Loggati sul conto che vuoi collegare                            |
//|   Apri un grafico EURUSD M1 (o qualsiasi simbolo)               |
//|   Trascina PropHedge_EA sul grafico                              |
//|   Inserisci Token e Journal ID dal software PropHedge            |
//|   (Journal → Connetti → MT4/MT5)                                |
//|   Clicca OK                                                       |
//|                                                                   |
//| STEP 4 — Salva template (avvio automatico)                       |
//|   Tasto destro sul grafico → Template → Salva template           |
//|   Nome: "PropHedge" → Salva                                      |
//|   Poi: Strumenti → Opzioni → Grafici                             |
//|   Spunta: "Salva grafici alla chiusura"                          |
//|   Da ora in poi MT4/MT5 avvia l'EA automaticamente!              |
//|                                                                   |
//| NOTA: Ripeti STEP 3 e 4 per ogni conto (prop e broker)           |
//|       usando lo stesso Journal ID ma AccountType diverso         |
//+------------------------------------------------------------------+

#property copyright "PropHedge - VISIONTRADING"
#property link      "https://prophedge-iota.vercel.app"
#property version   "3.0"
#property strict
#property description "Sincronizza i trade con il Journal PropHedge"

//+------------------------------------------------------------------+
//| PARAMETRI — copia dal software PropHedge                         |
//| Journal → clicca sfida → Connetti → MT4/MT5                     |
//+------------------------------------------------------------------+
input string UserToken   = ""; // Token utente (copia dal Journal)
input string JournalID   = ""; // Journal ID (copia dal Journal)
input string AccountType = "prop"; // Tipo: 'prop' oppure 'broker'
input int    SyncInterval = 30;    // Secondi tra sync (minimo 10)
input bool   SyncHistory  = true;  // Includi storico chiusi
input int    HistoryDays  = 90;    // Giorni storico da inviare

//+------------------------------------------------------------------+
//| Variabili interne — non modificare                               |
//+------------------------------------------------------------------+
string   SERVER    = "https://prophedge-iota.vercel.app";
string   ENDPOINT  = "";
datetime lastSync  = 0;
int      syncCount = 0;
int      errCount  = 0;
bool     ready     = false;

//+------------------------------------------------------------------+
int OnInit() {
   ENDPOINT = SERVER + "/api/mt-sync";

   if (StringLen(StringTrimLeft(StringTrimRight(UserToken))) < 10) {
      Alert("PropHedge EA — Token mancante!\n\n"
          + "Vai in PropHedge → Journal → Connetti → MT4/MT5\n"
          + "Copia il Token e incollalo nei parametri dell'EA.");
      return INIT_FAILED;
   }
   if (StringLen(StringTrimLeft(StringTrimRight(JournalID))) < 5) {
      Alert("PropHedge EA — Journal ID mancante!\n\n"
          + "Vai in PropHedge → Journal → Connetti → MT4/MT5\n"
          + "Copia il Journal ID e incollalo nei parametri dell'EA.");
      return INIT_FAILED;
   }
   if (AccountType != "prop" && AccountType != "broker") {
      Alert("PropHedge EA — AccountType non valido!\n\n"
          + "Inserisci 'prop' oppure 'broker' nel campo AccountType.");
      return INIT_FAILED;
   }

   ready = true;

   Print("══════════════════════════════════════");
   Print("  PropHedge EA v3.0 — VISIONTRADING  ");
   Print("══════════════════════════════════════");
   Print("  Broker:     ", AccountCompany());
   Print("  Conto:      #", AccountNumber());
   Print("  Server:     ", AccountServer());
   Print("  Valuta:     ", AccountCurrency());
   Print("  Tipo:       ", AccountType);
   Print("  Journal:    ", JournalID);
   Print("  Sync ogni:  ", MathMax(SyncInterval,10), " secondi");
   Print("  Storico:    ", SyncHistory ? (string)HistoryDays+" giorni" : "disabilitato");
   Print("══════════════════════════════════════");

   // Sync immediato all'avvio
   DoSync();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
   if (ready) Print("PropHedge EA fermato | Sync totali: ", syncCount, " | Errori: ", errCount);
}

//+------------------------------------------------------------------+
void OnTick() {
   if (!ready) return;
   if (TimeCurrent() - lastSync >= MathMax(SyncInterval, 10)) DoSync();
}

//+------------------------------------------------------------------+
// Timer di backup nel caso non arrivino tick (mercato chiuso)
void OnTimer() {
   if (!ready) return;
   if (TimeCurrent() - lastSync >= MathMax(SyncInterval, 10)) DoSync();
}

//+------------------------------------------------------------------+
void DoSync() {
   lastSync = TimeCurrent();
   string json = BuildJSON();
   if (SendToServer(json)) {
      syncCount++;
      if (syncCount == 1) {
         Print("PropHedge: Primo sync OK! I trade appaiono nel Journal.");
         Comment("PropHedge EA attivo\nConto: #" + (string)AccountNumber() + " (" + AccountType + ")\nSync: " + (string)syncCount + " | Errori: " + (string)errCount);
      } else {
         Comment("PropHedge EA attivo\nConto: #" + (string)AccountNumber() + " (" + AccountType + ")\nSync: " + (string)syncCount + " | Errori: " + (string)errCount + "\nUltimo: " + TimeToString(TimeCurrent(), TIME_DATE|TIME_MINUTES));
      }
   } else {
      errCount++;
      Comment("PropHedge EA — ERRORE #" + (string)errCount + "\nControllare log MT4 per dettagli");
   }
}

//+------------------------------------------------------------------+
string BuildJSON() {
   string trades = "";
   int    count  = 0;

   // Trade aperti
   for (int i = 0; i < OrdersTotal(); i++) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if (OrderType() > 1) continue; // Solo BUY e SELL
      if (count > 0) trades += ",";
      trades += OrderToJSON();
      count++;
      if (count >= 300) break;
   }

   // Storico chiusi
   if (SyncHistory) {
      datetime fromDate = TimeCurrent() - (datetime)(HistoryDays * 86400);
      for (int i = OrdersHistoryTotal() - 1; i >= 0; i--) {
         if (count >= 300) break;
         if (!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
         if (OrderType() > 1) continue;
         if (OrderOpenTime() < fromDate) continue;
         if (count > 0) trades += ",";
         trades += OrderToJSON();
         count++;
      }
   }

   // Costruisce JSON completo
   string plat = "MT4";
   string json = "{";
   json += "\"token\":\""       + CleanStr(UserToken)              + "\",";
   json += "\"journal_id\":\""  + CleanStr(JournalID)              + "\",";
   json += "\"account_type\":\"" + AccountType                      + "\",";
   json += "\"account_id\":\""  + (string)AccountNumber()          + "\",";
   json += "\"platform\":\""    + plat                             + "\",";
   json += "\"server\":\""      + CleanStr(AccountServer())        + "\",";
   json += "\"broker\":\""      + CleanStr(AccountCompany())       + "\",";
   json += "\"currency\":\""    + AccountCurrency()                + "\",";
   json += "\"balance\":"       + DoubleToStr(AccountBalance(),2)  + ",";
   json += "\"equity\":"        + DoubleToStr(AccountEquity(),2)   + ",";
   json += "\"trades\":["       + trades                           + "]";
   json += "}";
   return json;
}

//+------------------------------------------------------------------+
string OrderToJSON() {
   string t = "{";
   t += "\"ticket\":"      + (string)OrderTicket()              + ",";
   t += "\"symbol\":\""   + CleanStr(OrderSymbol())            + "\",";
   t += "\"type\":"        + (string)OrderType()                + ",";
   t += "\"lots\":"        + DoubleToStr(OrderLots(),2)         + ",";
   t += "\"open_price\":"  + DoubleToStr(OrderOpenPrice(),8)    + ",";
   t += "\"close_price\":" + DoubleToStr(OrderClosePrice(),8)   + ",";
   t += "\"sl\":"          + DoubleToStr(OrderStopLoss(),8)     + ",";
   t += "\"tp\":"          + DoubleToStr(OrderTakeProfit(),8)   + ",";
   t += "\"profit\":"      + DoubleToStr(OrderProfit(),2)       + ",";
   t += "\"swap\":"        + DoubleToStr(OrderSwap(),2)         + ",";
   t += "\"commission\":"  + DoubleToStr(OrderCommission(),2)   + ",";
   t += "\"open_time\":"   + (string)(int)OrderOpenTime()       + ",";
   t += "\"close_time\":"  + (string)(int)OrderCloseTime()      + ",";
   t += "\"comment\":\""  + CleanStr(OrderComment())           + "\",";
   t += "\"magic\":"       + (string)OrderMagicNumber();
   t += "}";
   return t;
}

//+------------------------------------------------------------------+
string CleanStr(string s) {
   StringReplace(s, "\"", "'");
   StringReplace(s, "\\", "/");
   StringReplace(s, "\n", " ");
   StringReplace(s, "\r", "");
   return s;
}

//+------------------------------------------------------------------+
bool SendToServer(string json) {
   string headers = "Content-Type: application/json\r\n";
   char   post[], result[];
   string resHeaders;

   StringToCharArray(json, post, 0, StringLen(json));
   ResetLastError();

   int code = WebRequest("POST", ENDPOINT, headers, 8000, post, result, resHeaders);

   if (code == -1) {
      int err = GetLastError();
      if (err == 4060) {
         Print("PropHedge ERRORE: URL non autorizzato!");
         Print("→ Strumenti → Opzioni → Expert Advisor → aggiungi: ", SERVER);
         Alert("PropHedge EA: devi aggiungere l'URL del server!\n\n"
             + "Strumenti → Opzioni → Expert Advisor\n"
             + "Aggiungi URL: " + SERVER);
      } else {
         Print("PropHedge ERRORE WebRequest #", err);
      }
      return false;
   }

   if (code == 200) {
      return true;
   } else if (code == 401) {
      Print("PropHedge ERRORE 401: Token non valido. Ricontrolla il Token nel Journal.");
      return false;
   } else if (code == 400) {
      Print("PropHedge ERRORE 400: Parametri errati. Controlla Journal ID e AccountType.");
      return false;
   } else {
      Print("PropHedge ERRORE HTTP ", code);
      return false;
   }
}
