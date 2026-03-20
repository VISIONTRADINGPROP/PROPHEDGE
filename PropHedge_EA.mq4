//+------------------------------------------------------------------+
//|                                           PropHedge_EA.mq4       |
//|                              PropHedge - VISIONTRADING           |
//|                                                                   |
//| INSTALLAZIONE:                                                    |
//| 1. File → Open Data Folder → MQL4 → Experts → incolla il file    |
//| 2. Riavvia MT4                                                    |
//| 3. Strumenti → Opzioni → Expert Advisor → aggiungi URL:          |
//|    https://prophedge-iota.vercel.app                             |
//| 4. Trascina PropHedge_EA su un grafico                           |
//| 5. Inserisci Email, API Key, Journal ID, AccountType             |
//+------------------------------------------------------------------+

#property copyright "PropHedge - VISIONTRADING"
#property link      "https://prophedge-iota.vercel.app"
#property version   "3.1"
#property strict
#property description "Sincronizza i trade con il Journal PropHedge"

//+------------------------------------------------------------------+
//| PARAMETRI — inserisci questi valori dal software PropHedge       |
//+------------------------------------------------------------------+
input string UserEmail   = "";         // La tua email di accesso PropHedge
input string ApiKey      = "";         // API Key (dal Journal → Connetti → MT4)
input string JournalID   = "";         // Journal ID (dal Journal → Connetti → MT4)
input string AccountType = "prop";     // Tipo conto: 'prop' oppure 'broker'
input int    SyncInterval = 30;        // Secondi tra ogni sync (min 10)
input bool   SyncHistory  = true;      // Includi storico trade chiusi
input int    HistoryDays  = 90;        // Giorni di storico da inviare

//+------------------------------------------------------------------+
string   SERVER   = "https://prophedge-iota.vercel.app";
string   ENDPOINT = "";
datetime lastSync = 0;
int      syncCount = 0;
int      errCount  = 0;
bool     ready     = false;

//+------------------------------------------------------------------+
int OnInit() {
   ENDPOINT = SERVER + "/api/mt-sync";

   if (StringLen(StringTrimLeft(StringTrimRight(UserEmail))) < 5) {
      Alert("PropHedge EA\n\nEmail mancante!\nInserisci la tua email di accesso PropHedge.");
      return INIT_FAILED;
   }
   if (StringLen(StringTrimLeft(StringTrimRight(ApiKey))) < 5) {
      Alert("PropHedge EA\n\nAPI Key mancante!\nVai in PropHedge → Journal → Connetti → MT4\nCopia la API Key.");
      return INIT_FAILED;
   }
   if (StringLen(StringTrimLeft(StringTrimRight(JournalID))) < 5) {
      Alert("PropHedge EA\n\nJournal ID mancante!\nVai in PropHedge → Journal → Connetti → MT4\nCopia il Journal ID.");
      return INIT_FAILED;
   }
   if (AccountType != "prop" && AccountType != "broker") {
      Alert("PropHedge EA\nAccountType deve essere 'prop' o 'broker'");
      return INIT_FAILED;
   }

   ready = true;

   Print("══════════════════════════════════════");
   Print("  PropHedge EA v3.1 — VISIONTRADING  ");
   Print("══════════════════════════════════════");
   Print("  Broker:     ", AccountCompany());
   Print("  Conto:      #", AccountNumber());
   Print("  Server:     ", AccountServer());
   Print("  Tipo:       ", AccountType);
   Print("  Email:      ", UserEmail);
   Print("  Journal:    ", JournalID);
   Print("══════════════════════════════════════");

   DoSync();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   if (ready) Print("PropHedge EA fermato | Sync: ", syncCount, " | Errori: ", errCount);
}

void OnTick() {
   if (!ready) return;
   if (TimeCurrent() - lastSync >= MathMax(SyncInterval, 10)) DoSync();
}

void DoSync() {
   lastSync = TimeCurrent();
   string json = BuildJSON();
   if (SendToServer(json)) {
      syncCount++;
      Comment("PropHedge EA attivo\n"
            + "Conto: #" + (string)AccountNumber() + " (" + AccountType + ")\n"
            + "Sync: " + (string)syncCount + " | Errori: " + (string)errCount + "\n"
            + "Ultimo: " + TimeToString(TimeCurrent(), TIME_DATE|TIME_MINUTES));
   } else {
      errCount++;
      Comment("PropHedge EA — ERRORE #" + (string)errCount + "\nControllare log MT4");
   }
}

string BuildJSON() {
   string trades = "";
   int count = 0;

   // Trade aperti
   for (int i = 0; i < OrdersTotal(); i++) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if (OrderType() > 1) continue;
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

   string json = "{";
   json += "\"api_key\":\""     + CleanStr(ApiKey)              + "\",";
   json += "\"email\":\""       + CleanStr(UserEmail)           + "\",";
   json += "\"journal_id\":\""  + CleanStr(JournalID)           + "\",";
   json += "\"account_type\":\"" + AccountType                   + "\",";
   json += "\"account_id\":\""  + (string)AccountNumber()       + "\",";
   json += "\"platform\":\"MT4\",";
   json += "\"server\":\""      + CleanStr(AccountServer())     + "\",";
   json += "\"broker\":\""      + CleanStr(AccountCompany())    + "\",";
   json += "\"currency\":\""    + AccountCurrency()             + "\",";
   json += "\"balance\":"       + DoubleToStr(AccountBalance(),2) + ",";
   json += "\"equity\":"        + DoubleToStr(AccountEquity(),2)  + ",";
   json += "\"trades\":["       + trades                         + "]";
   json += "}";
   return json;
}

string OrderToJSON() {
   string t = "{";
   t += "\"ticket\":"      + (string)OrderTicket()             + ",";
   t += "\"symbol\":\""   + CleanStr(OrderSymbol())           + "\",";
   t += "\"type\":"        + (string)OrderType()               + ",";
   t += "\"lots\":"        + DoubleToStr(OrderLots(),2)        + ",";
   t += "\"open_price\":"  + DoubleToStr(OrderOpenPrice(),8)   + ",";
   t += "\"close_price\":" + DoubleToStr(OrderClosePrice(),8)  + ",";
   t += "\"sl\":"          + DoubleToStr(OrderStopLoss(),8)    + ",";
   t += "\"tp\":"          + DoubleToStr(OrderTakeProfit(),8)  + ",";
   t += "\"profit\":"      + DoubleToStr(OrderProfit(),2)      + ",";
   t += "\"swap\":"        + DoubleToStr(OrderSwap(),2)        + ",";
   t += "\"commission\":"  + DoubleToStr(OrderCommission(),2)  + ",";
   t += "\"open_time\":"   + (string)(int)OrderOpenTime()      + ",";
   t += "\"close_time\":"  + (string)(int)OrderCloseTime()     + ",";
   t += "\"comment\":\""  + CleanStr(OrderComment())          + "\",";
   t += "\"magic\":"       + (string)OrderMagicNumber();
   t += "}";
   return t;
}

string CleanStr(string s) {
   StringReplace(s, "\"", "'");
   StringReplace(s, "\\", "/");
   StringReplace(s, "\n", " ");
   StringReplace(s, "\r", "");
   return s;
}

bool SendToServer(string json) {
   string headers = "Content-Type: application/json\r\n";
   char post[], result[];
   string resHeaders;
   StringToCharArray(json, post, 0, StringLen(json));
   ResetLastError();

   int code = WebRequest("POST", ENDPOINT, headers, 8000, post, result, resHeaders);

   if (code == -1) {
      int err = GetLastError();
      if (err == 4060) {
         Print("PropHedge ERRORE: URL non autorizzato!");
         Print("→ Strumenti → Opzioni → Expert Advisor → aggiungi: ", SERVER);
         Alert("PropHedge EA\n\nAggiungi l'URL:\nStrumenti → Opzioni → Expert Advisor\n" + SERVER);
      } else {
         Print("PropHedge ERRORE WebRequest #", err);
      }
      return false;
   }

   if (code == 200) {
      Print("PropHedge Sync #", syncCount+1, " OK");
      return true;
   }
   string resp = CharArrayToString(result);
   if (code == 401) Print("PropHedge ERRORE 401: API Key o email non valida. Ricontrolla i parametri.");
   else if (code == 400) Print("PropHedge ERRORE 400: Parametri mancanti.");
   else Print("PropHedge ERRORE HTTP ", code, ": ", StringSubstr(resp,0,200));
   return false;
}
