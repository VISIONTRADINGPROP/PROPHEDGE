//+------------------------------------------------------------------+
//|                                           PropHedge_EA.mq5       |
//|                              PropHedge - VISIONTRADING           |
//|                                                                   |
//| INSTALLAZIONE MT5:                                                |
//| 1. MT5 → File → Open Data Folder → MQL5 → Experts               |
//| 2. Copia PropHedge_EA.mq5 e riavvia MT5                          |
//| 3. Strumenti → Opzioni → Expert Advisor → aggiungi URL:          |
//|    https://prophedge-iota.vercel.app                             |
//| 4. Loggati sul conto da collegare                                 |
//| 5. Trascina PropHedge_EA su un grafico EURUSD M1                 |
//| 6. Inserisci Email, ApiKey, JournalID, AccountType               |
//| 7. Tasto destro → Template → Salva → "PropHedge"                |
//|    Strumenti → Opzioni → Grafici → spunta "Salva grafici"        |
//+------------------------------------------------------------------+

#property copyright "PropHedge - VISIONTRADING"
#property link      "https://prophedge-iota.vercel.app"
#property version   "3.10"
#property description "Sincronizza i trade con il Journal PropHedge"

#include <Trade\Trade.mqh>

//+------------------------------------------------------------------+
input string UserEmail   = "";      // La tua email PropHedge
input string ApiKey      = "";      // API Key (dal Journal → Connetti → MT5)
input string JournalID   = "";      // Journal ID (dal Journal → Connetti → MT5)
input string AccountType = "prop";  // Tipo: 'prop' oppure 'broker'
input int    SyncInterval = 30;     // Secondi tra sync (min 10)
input bool   SyncHistory  = true;   // Includi storico chiusi
input int    HistoryDays  = 90;     // Giorni storico

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

   string trimEmail = UserEmail;
   string trimKey   = ApiKey;
   string trimJID   = JournalID;
   StringTrimLeft(trimEmail);  StringTrimRight(trimEmail);
   StringTrimLeft(trimKey);    StringTrimRight(trimKey);
   StringTrimLeft(trimJID);    StringTrimRight(trimJID);

   if(StringLen(trimEmail) < 5) {
      Alert("PropHedge EA MT5\n\nEmail mancante!\nJournal → Connetti → MT5 → copia Email");
      return INIT_FAILED;
   }
   if(StringLen(trimKey) < 5) {
      Alert("PropHedge EA MT5\n\nAPI Key mancante!\nJournal → Connetti → MT5 → copia API Key");
      return INIT_FAILED;
   }
   if(StringLen(trimJID) < 5) {
      Alert("PropHedge EA MT5\n\nJournal ID mancante!\nJournal → Connetti → MT5 → copia Journal ID");
      return INIT_FAILED;
   }
   if(AccountType != "prop" && AccountType != "broker") {
      Alert("PropHedge EA MT5\nAccountType deve essere 'prop' o 'broker'");
      return INIT_FAILED;
   }

   ready = true;
   EventSetTimer(MathMax(SyncInterval, 10));

   Print("══════════════════════════════════════");
   Print("  PropHedge EA v3.1 MT5 — VISIONTRADING");
   Print("══════════════════════════════════════");
   Print("  Broker:  ", AccountInfoString(ACCOUNT_COMPANY));
   Print("  Conto:   #", IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)));
   Print("  Tipo:    ", AccountType);
   Print("  Email:   ", UserEmail);
   Print("  Journal: ", JournalID);
   Print("══════════════════════════════════════");

   DoSync();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason) {
   EventKillTimer();
   if(ready) Print("PropHedge EA MT5 fermato | Sync: ", syncCount, " | Errori: ", errCount);
}

void OnTick()  { if(!ready) return; if(TimeCurrent()-lastSync >= MathMax(SyncInterval,10)) DoSync(); }
void OnTimer() { if(!ready) return; DoSync(); }

void DoSync() {
   lastSync = TimeCurrent();
   string json = BuildJSON();
   if(SendToServer(json)) {
      syncCount++;
      Comment("PropHedge EA MT5 attivo\n"
            + "Conto: #" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + " (" + AccountType + ")\n"
            + "Sync: " + IntegerToString(syncCount) + " | Errori: " + IntegerToString(errCount) + "\n"
            + "Ultimo: " + TimeToString(TimeCurrent(), TIME_DATE|TIME_MINUTES));
   } else {
      errCount++;
      Comment("PropHedge EA MT5 — ERRORE #" + IntegerToString(errCount));
   }
}

string BuildJSON() {
   string trades = "";
   int count = 0;

   // Posizioni aperte
   for(int i = 0; i < PositionsTotal(); i++) {
      if(count >= 300) break;
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(count > 0) trades += ",";
      trades += PositionToJSON(ticket);
      count++;
   }

   // Storico chiusi
   if(SyncHistory && count < 300) {
      datetime fromDate = TimeCurrent() - (datetime)(HistoryDays * 86400);
      HistorySelect(fromDate, TimeCurrent());
      for(int i = HistoryDealsTotal()-1; i >= 0; i--) {
         if(count >= 300) break;
         ulong deal = HistoryDealGetTicket(i);
         if(deal == 0) continue;
         long entry = HistoryDealGetInteger(deal, DEAL_ENTRY);
         if(entry != DEAL_ENTRY_OUT) continue;
         long type = HistoryDealGetInteger(deal, DEAL_TYPE);
         if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL) continue;
         if(count > 0) trades += ",";
         trades += DealToJSON(deal);
         count++;
      }
   }

   string json = "{";
   json += "\"api_key\":\""      + CleanStr(ApiKey)                                           + "\",";
   json += "\"email\":\""        + CleanStr(UserEmail)                                        + "\",";
   json += "\"journal_id\":\""   + CleanStr(JournalID)                                        + "\",";
   json += "\"account_type\":\"" + AccountType                                                 + "\",";
   json += "\"account_id\":\""   + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))          + "\",";
   json += "\"platform\":\"MT5\",";
   json += "\"server\":\""       + CleanStr(AccountInfoString(ACCOUNT_SERVER))                 + "\",";
   json += "\"broker\":\""       + CleanStr(AccountInfoString(ACCOUNT_COMPANY))                + "\",";
   json += "\"currency\":\""     + AccountInfoString(ACCOUNT_CURRENCY)                         + "\",";
   json += "\"balance\":"        + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE),2)        + ",";
   json += "\"equity\":"         + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY),2)         + ",";
   json += "\"trades\":["        + trades                                                       + "]";
   json += "}";
   return json;
}

string PositionToJSON(ulong ticket) {
   string t = "{";
   t += "\"ticket\":"      + IntegerToString(ticket)                                      + ",";
   t += "\"symbol\":\""   + CleanStr(PositionGetString(POSITION_SYMBOL))                 + "\",";
   t += "\"type\":"        + IntegerToString((int)PositionGetInteger(POSITION_TYPE))      + ",";
   t += "\"lots\":"        + DoubleToString(PositionGetDouble(POSITION_VOLUME),2)         + ",";
   t += "\"open_price\":"  + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN),8)     + ",";
   t += "\"close_price\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT),8)  + ",";
   t += "\"sl\":"          + DoubleToString(PositionGetDouble(POSITION_SL),8)             + ",";
   t += "\"tp\":"          + DoubleToString(PositionGetDouble(POSITION_TP),8)             + ",";
   t += "\"profit\":"      + DoubleToString(PositionGetDouble(POSITION_PROFIT),2)         + ",";
   t += "\"swap\":"        + DoubleToString(PositionGetDouble(POSITION_SWAP),2)           + ",";
   t += "\"commission\":0,";
   t += "\"open_time\":"   + IntegerToString((int)PositionGetInteger(POSITION_TIME))      + ",";
   t += "\"close_time\":0,";
   t += "\"comment\":\""  + CleanStr(PositionGetString(POSITION_COMMENT))               + "\",";
   t += "\"magic\":"       + IntegerToString(PositionGetInteger(POSITION_MAGIC));
   t += "}";
   return t;
}

string DealToJSON(ulong deal) {
   // Cerca open_price e open_time dal deal di apertura
   ulong posId   = HistoryDealGetInteger(deal, DEAL_POSITION_ID);
   double open_p = HistoryDealGetDouble(deal, DEAL_PRICE);
   datetime open_t = (datetime)HistoryDealGetInteger(deal, DEAL_TIME);
   for(int j = 0; j < HistoryDealsTotal(); j++) {
      ulong d2 = HistoryDealGetTicket(j);
      if(d2 == 0) continue;
      if((ulong)HistoryDealGetInteger(d2, DEAL_POSITION_ID) != posId) continue;
      if(HistoryDealGetInteger(d2, DEAL_ENTRY) == DEAL_ENTRY_IN) {
         open_p  = HistoryDealGetDouble(d2, DEAL_PRICE);
         open_t  = (datetime)HistoryDealGetInteger(d2, DEAL_TIME);
         break;
      }
   }
   string t = "{";
   t += "\"ticket\":"      + IntegerToString(deal)                                              + ",";
   t += "\"symbol\":\""   + CleanStr(HistoryDealGetString(deal, DEAL_SYMBOL))                  + "\",";
   t += "\"type\":"        + IntegerToString((int)HistoryDealGetInteger(deal, DEAL_TYPE))       + ",";
   t += "\"lots\":"        + DoubleToString(HistoryDealGetDouble(deal, DEAL_VOLUME),2)          + ",";
   t += "\"open_price\":"  + DoubleToString(open_p,8)                                           + ",";
   t += "\"close_price\":" + DoubleToString(HistoryDealGetDouble(deal, DEAL_PRICE),8)           + ",";
   t += "\"sl\":0,\"tp\":0,";
   t += "\"profit\":"      + DoubleToString(HistoryDealGetDouble(deal, DEAL_PROFIT),2)          + ",";
   t += "\"swap\":"        + DoubleToString(HistoryDealGetDouble(deal, DEAL_SWAP),2)            + ",";
   t += "\"commission\":"  + DoubleToString(HistoryDealGetDouble(deal, DEAL_COMMISSION),2)      + ",";
   t += "\"open_time\":"   + IntegerToString((int)open_t)                                       + ",";
   t += "\"close_time\":"  + IntegerToString((int)HistoryDealGetInteger(deal, DEAL_TIME))       + ",";
   t += "\"comment\":\""  + CleanStr(HistoryDealGetString(deal, DEAL_COMMENT))                 + "\",";
   t += "\"magic\":"       + IntegerToString(HistoryDealGetInteger(deal, DEAL_MAGIC));
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
   char post[], result[];
   string headers = "Content-Type: application/json\r\n";
   string resHeaders;
   StringToCharArray(json, post, 0, StringLen(json));
   ResetLastError();
   int code = WebRequest("POST", ENDPOINT, headers, 8000, post, result, resHeaders);
   if(code == -1) {
      int err = GetLastError();
      if(err == 4014) {
         Print("PropHedge ERRORE: URL non autorizzato!");
         Print("→ Strumenti → Opzioni → Expert Advisor → aggiungi: ", SERVER);
         Alert("PropHedge EA MT5\n\nAggiungi URL:\nStrumenti → Opzioni → Expert Advisor\n" + SERVER);
      } else Print("PropHedge ERRORE WebRequest #", err);
      return false;
   }
   if(code == 200) { Print("PropHedge Sync #", syncCount+1, " OK"); return true; }
   string resp = CharArrayToString(result);
   if(code == 401) Print("PropHedge ERRORE 401: Email o API Key non valida");
   else if(code == 400) Print("PropHedge ERRORE 400: Parametri mancanti");
   else Print("PropHedge ERRORE HTTP ", code, ": ", StringSubstr(resp,0,200));
   return false;
}
