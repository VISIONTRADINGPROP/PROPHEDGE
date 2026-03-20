//+------------------------------------------------------------------+
//|                                           PropHedge_EA.mq5       |
//|                              PropHedge - VISIONTRADING           |
//|                                                                   |
//| INSTALLAZIONE MT5:                                                |
//| 1. MT5 → File → Open Data Folder                                 |
//| 2. Vai in MQL5 → Experts                                         |
//| 3. Copia PropHedge_EA.mq5 nella cartella e riavvia MT5           |
//| 4. Loggati sul conto da collegare                                 |
//| 5. Apri un grafico EURUSD M1                                     |
//| 6. Trascina PropHedge_EA sul grafico                             |
//| 7. Strumenti → Opzioni → Expert Advisor                          |
//|    Spunta "Consenti WebRequest" e aggiungi:                      |
//|    https://prophedge-iota.vercel.app                             |
//| 8. Inserisci Token e Journal ID dal Journal → Connetti → MT5     |
//| 9. Tasto destro grafico → Template → Salva → "PropHedge"        |
//|    Strumenti → Opzioni → Grafici → spunta "Salva grafici"        |
//|    ✅ Da ora MT5 avvia l'EA automaticamente!                     |
//+------------------------------------------------------------------+

#property copyright "PropHedge - VISIONTRADING"
#property link      "https://prophedge-iota.vercel.app"
#property version   "3.00"
#property description "Sincronizza i trade con il Journal PropHedge"

#include <Trade\Trade.mqh>

//+------------------------------------------------------------------+
//| PARAMETRI                                                         |
//+------------------------------------------------------------------+
input string UserToken   = "";      // Token utente (copia dal Journal)
input string JournalID   = "";      // Journal ID (copia dal Journal)
input string AccountType = "prop";  // Tipo conto: 'prop' oppure 'broker'
input int    SyncInterval = 30;     // Secondi tra sync (minimo 10)
input bool   SyncHistory  = true;   // Includi storico chiusi
input int    HistoryDays  = 90;     // Giorni storico

//+------------------------------------------------------------------+
//| Variabili interne                                                 |
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

   if(StringLen(StringTrimRight(StringTrimLeft(UserToken))) < 10) {
      Alert("PropHedge EA\n\nToken mancante!\nJournal → Connetti → MT5\nCopia il Token e incollalo qui.");
      return INIT_FAILED;
   }
   if(StringLen(StringTrimRight(StringTrimLeft(JournalID))) < 5) {
      Alert("PropHedge EA\n\nJournal ID mancante!\nJournal → Connetti → MT5\nCopia il Journal ID e incollalo qui.");
      return INIT_FAILED;
   }
   if(AccountType != "prop" && AccountType != "broker") {
      Alert("PropHedge EA\nAccountType deve essere 'prop' o 'broker'");
      return INIT_FAILED;
   }

   ready = true;

   // Timer per sync periodico (funziona anche a mercato chiuso)
   EventSetTimer(MathMax(SyncInterval, 10));

   Print("══════════════════════════════════════");
   Print("  PropHedge EA v3.0 MT5 — VISIONTRADING");
   Print("══════════════════════════════════════");
   Print("  Broker:     ", AccountInfoString(ACCOUNT_COMPANY));
   Print("  Conto:      #", AccountInfoInteger(ACCOUNT_LOGIN));
   Print("  Server:     ", AccountInfoString(ACCOUNT_SERVER));
   Print("  Valuta:     ", AccountInfoString(ACCOUNT_CURRENCY));
   Print("  Tipo:       ", AccountType);
   Print("  Journal:    ", JournalID);
   Print("  Sync ogni:  ", MathMax(SyncInterval,10), " secondi");
   Print("══════════════════════════════════════");

   DoSync();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
   EventKillTimer();
   if(ready) Print("PropHedge EA MT5 fermato | Sync: ", syncCount, " | Errori: ", errCount);
}

//+------------------------------------------------------------------+
void OnTick() {
   if(!ready) return;
   if(TimeCurrent() - lastSync >= MathMax(SyncInterval, 10)) DoSync();
}

//+------------------------------------------------------------------+
void OnTimer() {
   if(!ready) return;
   DoSync();
}

//+------------------------------------------------------------------+
void DoSync() {
   lastSync = TimeCurrent();
   string json = BuildJSON();
   if(SendToServer(json)) {
      syncCount++;
      string msg = "PropHedge EA MT5 attivo\n"
                 + "Conto: #" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))
                 + " (" + AccountType + ")\n"
                 + "Sync: " + IntegerToString(syncCount)
                 + " | Errori: " + IntegerToString(errCount) + "\n"
                 + "Ultimo: " + TimeToString(TimeCurrent(), TIME_DATE|TIME_MINUTES);
      Comment(msg);
   } else {
      errCount++;
      Comment("PropHedge EA MT5 — ERRORE #" + IntegerToString(errCount) + "\nVerifica log MT5");
   }
}

//+------------------------------------------------------------------+
string BuildJSON() {
   string trades = "";
   int count = 0;

   // ── POSIZIONI APERTE (MT5 usa PositionGet) ────────────────────
   for(int i = 0; i < PositionsTotal(); i++) {
      if(count >= 300) break;
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;

      string sym    = PositionGetString(POSITION_SYMBOL);
      int    type   = (int)PositionGetInteger(POSITION_TYPE); // 0=BUY 1=SELL
      double lots   = PositionGetDouble(POSITION_VOLUME);
      double open_p = PositionGetDouble(POSITION_PRICE_OPEN);
      double cur_p  = PositionGetDouble(POSITION_PRICE_CURRENT);
      double sl     = PositionGetDouble(POSITION_SL);
      double tp     = PositionGetDouble(POSITION_TP);
      double profit = PositionGetDouble(POSITION_PROFIT);
      double swap   = PositionGetDouble(POSITION_SWAP);
      datetime open_t = (datetime)PositionGetInteger(POSITION_TIME);
      string comment  = CleanStr(PositionGetString(POSITION_COMMENT));
      long   magic    = PositionGetInteger(POSITION_MAGIC);

      if(count > 0) trades += ",";
      trades += "{";
      trades += "\"ticket\":"      + IntegerToString(ticket)  + ",";
      trades += "\"symbol\":\""   + CleanStr(sym)             + "\",";
      trades += "\"type\":"        + IntegerToString(type)     + ",";
      trades += "\"lots\":"        + DoubleToString(lots,2)    + ",";
      trades += "\"open_price\":"  + DoubleToString(open_p,8)  + ",";
      trades += "\"close_price\":" + DoubleToString(cur_p,8)   + ",";
      trades += "\"sl\":"          + DoubleToString(sl,8)      + ",";
      trades += "\"tp\":"          + DoubleToString(tp,8)      + ",";
      trades += "\"profit\":"      + DoubleToString(profit,2)  + ",";
      trades += "\"swap\":"        + DoubleToString(swap,2)    + ",";
      trades += "\"commission\":0,";
      trades += "\"open_time\":"   + IntegerToString((int)open_t) + ",";
      trades += "\"close_time\":0,";
      trades += "\"comment\":\""  + comment                   + "\",";
      trades += "\"magic\":"       + IntegerToString(magic);
      trades += "}";
      count++;
   }

   // ── STORICO CHIUSI (MT5 usa HistoryDeal) ─────────────────────
   if(SyncHistory && count < 300) {
      datetime fromDate = TimeCurrent() - (datetime)(HistoryDays * 86400);
      HistorySelect(fromDate, TimeCurrent());

      // Raggruppa deal per positionID per ricostruire i trade
      for(int i = HistoryDealsTotal() - 1; i >= 0; i--) {
         if(count >= 300) break;
         ulong dealTicket = HistoryDealGetTicket(i);
         if(dealTicket == 0) continue;

         // Solo deal di chiusura (DEAL_ENTRY_OUT)
         long entry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
         if(entry != DEAL_ENTRY_OUT) continue;

         long   type    = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
         if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL) continue;

         string sym     = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
         double lots    = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
         double price   = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
         double profit  = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
         double swap    = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
         double comm    = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
         datetime close_t = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
         ulong posId    = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
         string comment = CleanStr(HistoryDealGetString(dealTicket, DEAL_COMMENT));
         long   magic   = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);

         // Cerca il deal di apertura per avere open_price e open_time
         double open_p  = price;
         datetime open_t = close_t;
         for(int j = 0; j < HistoryDealsTotal(); j++) {
            ulong d2 = HistoryDealGetTicket(j);
            if(d2 == 0) continue;
            if((ulong)HistoryDealGetInteger(d2, DEAL_POSITION_ID) != posId) continue;
            long e2 = HistoryDealGetInteger(d2, DEAL_ENTRY);
            if(e2 == DEAL_ENTRY_IN) {
               open_p = HistoryDealGetDouble(d2, DEAL_PRICE);
               open_t = (datetime)HistoryDealGetInteger(d2, DEAL_TIME);
               break;
            }
         }

         if(count > 0) trades += ",";
         trades += "{";
         trades += "\"ticket\":"      + IntegerToString(dealTicket) + ",";
         trades += "\"symbol\":\""   + CleanStr(sym)                + "\",";
         trades += "\"type\":"        + IntegerToString((int)type)   + ",";
         trades += "\"lots\":"        + DoubleToString(lots,2)       + ",";
         trades += "\"open_price\":"  + DoubleToString(open_p,8)     + ",";
         trades += "\"close_price\":" + DoubleToString(price,8)      + ",";
         trades += "\"sl\":0,\"tp\":0,";
         trades += "\"profit\":"      + DoubleToString(profit,2)     + ",";
         trades += "\"swap\":"        + DoubleToString(swap,2)       + ",";
         trades += "\"commission\":"  + DoubleToString(comm,2)       + ",";
         trades += "\"open_time\":"   + IntegerToString((int)open_t) + ",";
         trades += "\"close_time\":"  + IntegerToString((int)close_t)+ ",";
         trades += "\"comment\":\""  + comment                      + "\",";
         trades += "\"magic\":"       + IntegerToString(magic);
         trades += "}";
         count++;
      }
   }

   string json = "{";
   json += "\"token\":\""        + CleanStr(UserToken)                                   + "\",";
   json += "\"journal_id\":\""   + CleanStr(JournalID)                                   + "\",";
   json += "\"account_type\":\"" + AccountType                                            + "\",";
   json += "\"account_id\":\""   + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN))     + "\",";
   json += "\"platform\":\"MT5\",";
   json += "\"server\":\""       + CleanStr(AccountInfoString(ACCOUNT_SERVER))            + "\",";
   json += "\"broker\":\""       + CleanStr(AccountInfoString(ACCOUNT_COMPANY))           + "\",";
   json += "\"currency\":\""     + AccountInfoString(ACCOUNT_CURRENCY)                    + "\",";
   json += "\"balance\":"        + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE),2)   + ",";
   json += "\"equity\":"         + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY),2)    + ",";
   json += "\"trades\":["        + trades                                                  + "]";
   json += "}";
   return json;
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
         Alert("PropHedge EA MT5\n\nAggiungi l'URL nelle impostazioni:\nStrumenti → Opzioni → Expert Advisor\nURL: " + SERVER);
      } else {
         Print("PropHedge ERRORE WebRequest #", err);
      }
      return false;
   }

   if(code == 200) return true;

   string resp = CharArrayToString(result);
   if(code == 401) Print("PropHedge ERRORE 401: Token non valido");
   else if(code == 400) Print("PropHedge ERRORE 400: Parametri errati");
   else Print("PropHedge ERRORE HTTP ", code, ": ", StringSubstr(resp,0,100));
   return false;
}
