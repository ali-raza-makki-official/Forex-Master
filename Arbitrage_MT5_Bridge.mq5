//+------------------------------------------------------------------+
//|                                         Arbitrage_MT5_Bridge.mq5 |
//|                                  Copyright 2026, Antigravity AI  |
//|                                             https://google.com   |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, Antigravity AI"
#property link      "https://google.com"
#property version   "1.03"
#property description "High-frequency MQL5 Local Bridge for Arbitrage Engine"
#property strict

//--- Inputs
input string   ServerHost     = "127.0.0.1"; // Node Server IP
input int      ServerPort     = 3001;        // Node Server Port
input int      PingIntervalS  = 1;           // Heartbeat Interval (Seconds)
input int      MaxSlippage    = 3;           // Max Slippage (Points)
input string   AuthToken      = "ForexMasterSecureToken2026"; // Secret Authentication Token

//--- WinAPI Declarations for Low-latency Winsock Sockets (Allow DLL Imports must be checked!)
#import "ws2_32.dll"
int WSAStartup(ushort wVersionRequested, uchar &lpWSAData[]);
int WSACleanup();
ulong socket(int af, int type, int protocol);
int closesocket(ulong s);
int connect(ulong s, uchar &sockaddr[], int namelen);
int send(ulong s, uchar &buf[], int len, int flags);
int recv(ulong s, uchar &buf[], int len, int flags);
int ioctlsocket(ulong s, uint cmd, uint &argp);
int WSAGetLastError();
#import

#import "kernel32.dll"
uint GetLastError();
#import

//--- Globals
ulong     m_socket = 0;
bool      m_connected = false;
datetime  m_last_ping = 0;
uchar     m_rx_buffer[65536]; // 64KB Buffer
string    m_processed_ids[];  // Cache for duplicate prevention
string    m_command_queue[];  // Queue for simultaneous signals
string    m_handshake_key = "dGhlIHNhbXBsZSBub25jZQ==";

//--- Multitasking Symbol Streaming Configuration
string m_symbols_to_track[];
int    m_symbols_count = 0;
double m_last_bids[];
double m_last_asks[];

void SendAvailableSymbols();
void ProcessCommand(string json);
string ExtractJsonValue(string json, string key);

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("[BRIDGE] Initializing Arbitrage MT5 Bridge EA...");
   uchar wsaData[400];
   int res = WSAStartup(0x0202, wsaData); // Request Winsock 2.2
   if(res != 0)
   {
      Print("[ERROR] WSAStartup failed with error: ", res);
      return(INIT_FAILED);
   }
   
   // Seed random for WebSocket masking
   MathSrand(uint(TimeLocal()));
   
   // Run OnTimer at 100 millisecond resolution for high-frequency multi-pair tracking
   EventSetMillisecondTimer(100);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("[BRIDGE] Deinitializing...");
   Disconnect();
   WSACleanup();
   EventKillTimer();
}

//+------------------------------------------------------------------+
//| Stream real-time bid/ask updates for all registered symbols      |
//+------------------------------------------------------------------+
void StreamPrices()
{
   if(!m_connected || m_symbols_count <= 0) return;
   
   for(int i = 0; i < m_symbols_count; i++)
   {
      string sym = m_symbols_to_track[i];
      
      double bid = SymbolInfoDouble(sym, SYMBOL_BID);
      double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
      
      // Only stream if the price is valid and has changed
      if(bid > 0 && (bid != m_last_bids[i] || ask != m_last_asks[i]))
      {
         m_last_bids[i] = bid;
         m_last_asks[i] = ask;
         
         int digits = int(SymbolInfoInteger(sym, SYMBOL_DIGITS));
         string payload = "{\"event\":\"price_update\",\"symbol\":\"" + sym + "\",\"bid\":" + DoubleToJSON(bid, digits) + ",\"ask\":" + DoubleToJSON(ask, digits) + "}";
         SendWebSocketFrame(payload);
      }
   }
}

//+------------------------------------------------------------------+
//| Timer function for low-latency reconnects and heartbeats         |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!m_connected)
   {
      Connect();
   }
   else
   {
      datetime now = TimeLocal();
      if(now - m_last_ping >= PingIntervalS)
      {
         SendHeartbeat();
         m_last_ping = now;
      }
      
      // Ultra low latency multi-symbol price streaming
      StreamPrices();
      
      // Receive and process any pending socket data
      ReceiveData();
      
      // Drain entire Command Queue (Sequential low-latency execution)
      while(ArraySize(m_command_queue) > 0)
      {
         string cmd = m_command_queue[0];
         ProcessCommand(cmd);
         ArrayRemove(m_command_queue, 0, 1);
      }
   }
}

//+------------------------------------------------------------------+
//| Chart tick event to stream real-time price ticks to Node server   |
//+------------------------------------------------------------------+
void OnTick()
{
   // Stream all prices instantly if a chart tick occurs (for sub-millisecond response)
   StreamPrices();
   
   // Also check for incoming trade commands instantly on every price tick (latency optimization)
   if(m_connected)
   {
      ReceiveData();
      
      // Drain entire Command Queue instantly on tick arrival
      while(ArraySize(m_command_queue) > 0)
      {
         string cmd = m_command_queue[0];
         ProcessCommand(cmd);
         ArrayRemove(m_command_queue, 0, 1);
      }
   }
}

//+------------------------------------------------------------------+
//| Connect to Node.js WebSocket Server                              |
//+------------------------------------------------------------------+
bool Connect()
{
   Disconnect();
   
   m_socket = socket(2, 1, 6); // AF_INET, SOCK_STREAM, IPPROTO_TCP
   if(m_socket == 0 || m_socket == (ulong)-1)
   {
      Print("[ERROR] Socket creation failed! Check if DLL imports are allowed in MT5.");
      return false;
   }
   
   // Prepare sockaddr_in
   uchar sockaddr[16];
   ArrayInitialize(sockaddr, 0);
   
   sockaddr[0] = 2; // sin_family = AF_INET
   
   // Port (Big Endian)
   sockaddr[2] = uchar((ServerPort >> 8) & 0xFF);
   sockaddr[3] = uchar(ServerPort & 0xFF);
   
   // Resolve IP (Assuming IPv4 dot notation, e.g., 127.0.0.1)
   string parts[];
   int part_count = StringSplit(ServerHost, '.', parts);
   if(part_count == 4)
   {
      sockaddr[4] = uchar(StringToInteger(parts[0]));
      sockaddr[5] = uchar(StringToInteger(parts[1]));
      sockaddr[6] = uchar(StringToInteger(parts[2]));
      sockaddr[7] = uchar(StringToInteger(parts[3]));
   }
   else
   {
      Print("[ERROR] Invalid Host IP configuration: ", ServerHost);
      closesocket(m_socket);
      m_socket = 0;
      return false;
   }
   
   // Call connect in blocking mode (will connect to localhost instantly!)
   int connect_res = connect(m_socket, sockaddr, 16);
   if(connect_res != 0)
   {
      int err = WSAGetLastError();
      Print("[ERROR] TCP connect to ", ServerHost, ":", ServerPort, " failed with Winsock Error Code: ", err);
      closesocket(m_socket);
      m_socket = 0;
      return false;
   }
   
   // Perform WebSocket Handshake while socket is still in blocking mode (guarantees handshake success!)
   if(!PerformHandshake())
   {
      closesocket(m_socket);
      m_socket = 0;
      return false;
   }
   
   // Connection & Handshake succeeded! NOW set to Non-blocking mode so EA doesn't freeze during trading
   uint nonBlocking = 1;
   ioctlsocket(m_socket, 0x8004667E, nonBlocking); // FIONBIO
   
   m_connected = true;
   m_last_ping = TimeLocal();
   Print("[BRIDGE] 🟢 Successfully Connected & Shook Hands with Local Bridge Server!");
   SendHeartbeat();
   SendAvailableSymbols();
   return true;
}

//+------------------------------------------------------------------+
//| Close connection cleanly                                         |
//+------------------------------------------------------------------+
void Disconnect()
{
   if(m_socket != 0)
   {
      closesocket(m_socket);
      m_socket = 0;
   }
   if(m_connected)
   {
      m_connected = false;
      Print("[BRIDGE] 🔴 Disconnected from Local Bridge Server.");
   }
}

//+------------------------------------------------------------------+
//| Send WebSocket handshake request                                 |
//+------------------------------------------------------------------+
bool PerformHandshake()
{
   string handshake = "GET / HTTP/1.1\r\n" +
                      "Host: " + ServerHost + ":" + IntegerToString(ServerPort) + "\r\n" +
                      "Upgrade: websocket\r\n" +
                      "Connection: Upgrade\r\n" +
                      "Authorization: Bearer " + AuthToken + "\r\n" +
                      "Sec-WebSocket-Key: " + m_handshake_key + "\r\n" +
                      "Sec-WebSocket-Version: 13\r\n\r\n";
                      
   uchar req_bytes[];
   int total_len = StringToCharArray(handshake, req_bytes); 
   int send_len = total_len - 1; // Exclude null-terminator
   
   Print("[DEBUG] Sending Handshake of size ", send_len, " bytes...");
   int sent_bytes = send(m_socket, req_bytes, send_len, 0);
   if(sent_bytes == -1)
   {
      int err = WSAGetLastError();
      Print("[ERROR] Handshake send failed with Winsock Error: ", err);
      return false;
   }
   else
   {
      Print("[DEBUG] Sent ", sent_bytes, " bytes of Handshake successfully. Waiting for response...");
   }
   
   // Wait for HTTP 101 response
   uchar rx_buf[1024];
   int bytes = recv(m_socket, rx_buf, 1024, 0);
   if(bytes > 0)
   {
      string response = CharArrayToString(rx_buf, 0, bytes);
      if(StringFind(response, "HTTP/1.1 101") >= 0)
      {
         return true;
      }
      else
      {
         Print("[ERROR] Handshake unexpected response: ", response);
      }
   }
   else
   {
      int err = WSAGetLastError();
      Print("[ERROR] Handshake recv failed with Winsock Error: ", err);
   }
   
   return false;
}

//+------------------------------------------------------------------+
//| Send data frame over the WebSocket protocol                     |
//+------------------------------------------------------------------+
void SendWebSocketFrame(string message)
{
   if(!m_connected || m_socket == 0) return;
   
   uchar msg_bytes[];
   int len = StringToCharArray(message, msg_bytes, 0, -1) - 1;
   
   int frame_size = 0;
   uchar frame[]; 
   ArrayResize(frame, len + 14); // Dynamic allocation
   
   frame[0] = 0x81; // FIN + Text frame
   
   // Masking is mandatory for client-to-server frames per RFC 6455
   uchar mask[4];
   mask[0] = uchar(MathRand() % 256);
   mask[1] = uchar(MathRand() % 256);
   mask[2] = uchar(MathRand() % 256);
   mask[3] = uchar(MathRand() % 256);   
   if(len < 126)
   {
      frame[1] = uchar(len | 0x80); // Set Mask bit to 1
      frame[2] = mask[0];
      frame[3] = mask[1];
      frame[4] = mask[2];
      frame[5] = mask[3];
      frame_size = 6;
   }
   else
   {
      frame[1] = uchar(126 | 0x80);
      frame[2] = uchar((len >> 8) & 0xFF);
      frame[3] = uchar(len & 0xFF);
      frame[4] = mask[0];
      frame[5] = mask[1];
      frame[6] = mask[2];
      frame[7] = mask[3];
      frame_size = 8;
   }
   
   // Apply Masking Key to payload
   for(int i = 0; i < len; i++)
   {
      frame[frame_size + i] = uchar(msg_bytes[i] ^ mask[i % 4]);
   }
   
   send(m_socket, frame, frame_size + len, 0);
}

//+------------------------------------------------------------------+
//| Periodically transmit active balance and active trading positions |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   
   string positions_json = "[";
   int pos_count = PositionsTotal();
   int added = 0;
   
   for(int i = 0; i < pos_count; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0)
      {
         Print("[BRIDGE] Warning: Could not select position at index ", i);
         continue;
      }
      
      string sym = PositionGetString(POSITION_SYMBOL);
      double vol = PositionGetDouble(POSITION_VOLUME);
      double op = PositionGetDouble(POSITION_PRICE_OPEN);
      double cp = PositionGetDouble(POSITION_PRICE_CURRENT);
      double profit = PositionGetDouble(POSITION_PROFIT);
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);
      long type = PositionGetInteger(POSITION_TYPE);
      
      string type_str = (type == POSITION_TYPE_BUY) ? "BUY" : "SELL";
      
      if(added > 0) positions_json += ",";
      positions_json += "{\"id\":" + IntegerToString(ticket) + 
                        ",\"symbol\":\"" + sym + "\"" +
                        ",\"type\":\"" + type_str + "\"" +
                        ",\"volume\":" + DoubleToJSON(vol, 2) + 
                        ",\"openPrice\":" + DoubleToJSON(op, 5) + 
                        ",\"currentPrice\":" + DoubleToJSON(cp, 5) + 
                        ",\"profit\":" + DoubleToJSON(profit, 2) + 
                        ",\"sl\":" + DoubleToJSON(sl, 5) + 
                        ",\"tp\":" + DoubleToJSON(tp, 5) + "}";
      added++;
   }
   positions_json += "]";
   
   string payload = "{\"event\":\"heartbeat\",\"balance\":" + DoubleToJSON(balance, 2) + ",\"positions\":" + positions_json + "}";
   SendWebSocketFrame(payload);
}

//+------------------------------------------------------------------+
//| Read incoming socket packets and decode websocket frames         |
//| Supports packet coalescing to process multiple packets in stream  |
//+------------------------------------------------------------------+
void ReceiveData()
{
   if(!m_connected || m_socket == 0) return;
   
   int bytes = recv(m_socket, m_rx_buffer, 65536, 0);
   if(bytes == 0)
   {
      Print("[BRIDGE] 🔴 Connection closed gracefully by remote server.");
      Disconnect();
      return;
   }
   else if(bytes < 0)
   {
      int err = WSAGetLastError();
      if(err != 10035) // WSAEWOULDBLOCK
      {
         Print("[BRIDGE] 🔴 Socket read error: ", err, ". Disconnecting.");
         Disconnect();
      }
      return;
   }
   
   // Loop to parse all coalesced/merged WebSocket frames in TCP buffer
   int offset = 0;
   while(offset < bytes)
   {
      if(offset + 2 > bytes) break; // Incomplete frame header
      
      uchar opcode = m_rx_buffer[offset] & 0x0F;
      if(opcode == 8) // Close
      {
         Disconnect();
         return;
      }
      if(opcode == 9) // Ping
      {
         uchar pong[2] = {0x8A, 0x00};
         send(m_socket, pong, 2, 0);
         offset += 2;
         continue;
      }
      
      if(opcode == 1) // Text frame
      {
         ulong len = m_rx_buffer[offset + 1] & 0x7F;
         int payload_offset = 2;
         
         if(len == 126)
         {
            if(offset + 4 > bytes) break; // Incomplete header
            len = (m_rx_buffer[offset + 2] << 8) | m_rx_buffer[offset + 3];
            payload_offset = 4;
         }
         
         if(offset + payload_offset + int(len) > bytes) break; // Incomplete payload
         
         string json_str = CharArrayToString(m_rx_buffer, offset + payload_offset, int(len));
         
         // Queue command with safety bounds check (prevent memory leak from flood)
         int qSize = ArraySize(m_command_queue);
         if(qSize < 100)
         {
            ArrayResize(m_command_queue, qSize + 1);
            m_command_queue[qSize] = json_str;
         }
         else
         {
            Print("[BRIDGE] ⚠️ Command queue overflow (100). Dropping incoming command to prevent memory leak.");
         }
         
         offset += payload_offset + int(len);
      }
      else
      {
         // Skip unknown opcodes
         offset++;
      }
   }
}

//+------------------------------------------------------------------+
//| Multi-Broker Symbol Alias Resolver                               |
//| Automatically matches CFD index names across different brokers   |
//+------------------------------------------------------------------+
string ResolveBrokerSymbol(string reqSymbol)
{
   string sym = reqSymbol;
   StringTrimLeft(sym);
   StringTrimRight(sym);
   StringReplace(sym, " ", "");
   string sym_upper = sym;
   StringToUpper(sym_upper);
   
   // 1. Direct match check
   if(SymbolSelect(sym, true)) return sym;
   if(SymbolSelect(sym_upper, true)) return sym_upper;
   
   // 2. Suffix match (.m, .cfd, .cx, etc.)
   string common_suffixes[7];
   common_suffixes[0] = ".m";
   common_suffixes[1] = ".cfd";
   common_suffixes[2] = ".cx";
   common_suffixes[3] = ".z";
   common_suffixes[4] = "i";
   common_suffixes[5] = "-m";
   common_suffixes[6] = "-sb";
   
   for(int s = 0; s < 7; s++) {
      string test1 = sym + common_suffixes[s];
      string test2 = sym_upper + common_suffixes[s];
      if(SymbolSelect(test1, true)) return test1;
      if(SymbolSelect(test2, true)) return test2;
   }
   
   // 3. Known index/asset cross-broker alias mappings
   string aliases[8];
   int alias_count = 0;
   
   if(sym_upper == "SPX500" || sym_upper == "SPX" || sym_upper == "US500" || sym_upper == "S&P500" || sym_upper == "USA500") {
      aliases[0] = "US500"; aliases[1] = "SPX500"; aliases[2] = "SPX"; aliases[3] = "USA500"; 
      aliases[4] = "US500Cash"; aliases[5] = "S&P500"; aliases[6] = ".SPX500"; aliases[7] = "US 500";
      alias_count = 8;
   }
   else if(sym_upper == "NAS100" || sym_upper == "USTEC" || sym_upper == "US100" || sym_upper == "NASDAQ100" || sym_upper == "NASDAQ") {
      aliases[0] = "USTEC"; aliases[1] = "NAS100"; aliases[2] = "US100"; aliases[3] = "NASDAQ100"; 
      aliases[4] = "NASCash"; aliases[5] = "NASDAQ"; aliases[6] = ".NAS100"; aliases[7] = "US Tech 100";
      alias_count = 8;
   }
   else if(sym_upper == "US30" || sym_upper == "DJI" || sym_upper == "DJ30" || sym_upper == "DOW" || sym_upper == "WALLSTREET") {
      aliases[0] = "US30"; aliases[1] = "DJI"; aliases[2] = "DJ30"; aliases[3] = "US30Cash"; 
      aliases[4] = "WallStreet30"; aliases[5] = "DOWJONES"; aliases[6] = ".US30"; aliases[7] = "Dow Jones 30";
      alias_count = 8;
   }
   else if(sym_upper == "GOLD" || sym_upper == "XAUUSD" || sym_upper == "XAU") {
      aliases[0] = "XAUUSD"; aliases[1] = "GOLD"; aliases[2] = "XAUUSD.m"; aliases[3] = "GOLD.m"; 
      aliases[4] = "XAUUSD.cfd"; aliases[5] = "GOLD.cfd"; aliases[6] = "XAU"; aliases[7] = "XAUUSD.m";
      alias_count = 8;
   }
   else if(sym_upper == "SILVER" || sym_upper == "XAGUSD" || sym_upper == "XAG") {
      aliases[0] = "XAGUSD"; aliases[1] = "SILVER"; aliases[2] = "XAGUSD.m"; aliases[3] = "SILVER.m"; 
      aliases[4] = "XAGUSD.cfd"; aliases[5] = "SILVER.cfd"; aliases[6] = "XAG"; aliases[7] = "XAGUSD.m";
      alias_count = 8;
   }
   else if(sym_upper == "GER30" || sym_upper == "DE30" || sym_upper == "DAX" || sym_upper == "DE40" || sym_upper == "GER40") {
      aliases[0] = "GER30"; aliases[1] = "DE30"; aliases[2] = "DAX30"; aliases[3] = "GER40"; 
      aliases[4] = "DE40"; aliases[5] = "DAX40"; aliases[6] = "DAX"; aliases[7] = "Germany40";
      alias_count = 8;
   }
   else if(sym_upper == "US10Y" || sym_upper == "UST10Y" || sym_upper == "US10YR" || sym_upper == "TNOTE") {
      aliases[0] = "US10Y"; aliases[1] = "UST10Y"; aliases[2] = "US10YR"; aliases[3] = "TNOTE";
      aliases[4] = "US10Y_Cash"; aliases[5] = "US10"; aliases[6] = ".US10Y"; aliases[7] = "US10Y.m";
      alias_count = 8;
   }
   else if(sym_upper == "DXY" || sym_upper == "USDINDEX" || sym_upper == "USDX") {
      aliases[0] = "DXY"; aliases[1] = "USDX"; aliases[2] = "USDIndex"; aliases[3] = ".DXY";
      aliases[4] = "DXY.m"; aliases[5] = "USDIndex.m"; aliases[6] = "DXY_Cash"; aliases[7] = "DXY_m";
      alias_count = 8;
   }
   
   // Try mappings directly and with suffixes
   for(int a = 0; a < alias_count; a++) {
      string alias = aliases[a];
      if(alias == "") continue;
      if(SymbolSelect(alias, true)) return alias;
      
      string alias_upper = alias;
      StringToUpper(alias_upper);
      if(SymbolSelect(alias_upper, true)) return alias_upper;
      
      for(int s = 0; s < 7; s++) {
         string test1 = alias + common_suffixes[s];
         string test2 = alias_upper + common_suffixes[s];
         if(SymbolSelect(test1, true)) return test1;
         if(SymbolSelect(test2, true)) return test2;
      }
   }
   
   // 4. Broker-wide Database Scan (Loops through symbols list)
   int totalSymbols = SymbolsTotal(false); // Try Market Watch first
   for(int i = 0; i < totalSymbols; i++) {
      string name = SymbolName(i, false);
      string name_upper = name;
      StringToUpper(name_upper);
      if(StringFind(name_upper, sym_upper) >= 0 || StringFind(sym_upper, name_upper) >= 0) {
         if(SymbolSelect(name, true)) return name;
      }
   }
   
   totalSymbols = SymbolsTotal(true); // Try all terminal symbols
   for(int i = 0; i < totalSymbols; i++) {
      string name = SymbolName(i, true);
      string name_upper = name;
      StringToUpper(name_upper);
      if(StringFind(name_upper, sym_upper) >= 0 || StringFind(sym_upper, name_upper) >= 0) {
         if(SymbolSelect(name, true)) return name;
      }
   }
   
   return ""; // Not found
}

//+------------------------------------------------------------------+
//| Handle trade execution and close commands received from Node server|
//+------------------------------------------------------------------+
void ProcessCommand(string json)
{
   if(StringFind(json, "\"action\":\"trade\"") >= 0)
   {
      string reqId = ExtractJsonValue(json, "\"id\"");
      string raw_symbol = ExtractJsonValue(json, "\"symbol\"");
      string symbol = ResolveBrokerSymbol(raw_symbol);
      if(symbol == "") symbol = raw_symbol; // fallback
      
      string type = ExtractJsonValue(json, "\"type\"");
      double volume = StringToDouble(ExtractJsonValue(json, "\"volume\""));
      double sl_points = StringToDouble(ExtractJsonValue(json, "\"sl\""));
      double tp_points = StringToDouble(ExtractJsonValue(json, "\"tp\""));
      
      // Duplicate Order Prevention Check
      bool already_processed = false;
      for(int i = 0; i < ArraySize(m_processed_ids); i++) {
         if(m_processed_ids[i] == reqId) { already_processed = true; break; }
      }
      if(already_processed) {
         Print("[BRIDGE] ⚠️ Duplicate Trade ID Ignored: ", reqId);
         return;
      }
      
      // Add to cache
      int cacheSize = ArraySize(m_processed_ids);
      ArrayResize(m_processed_ids, cacheSize + 1);
      m_processed_ids[cacheSize] = reqId;
      if(ArraySize(m_processed_ids) > 100) ArrayRemove(m_processed_ids, 0, 1);
      
      Print("[BRIDGE] 📥 Trade Command Received: ", type, " ", volume, " Lots of ", symbol);
      
      MqlTradeRequest request;
      MqlTradeResult result;
      ZeroMemory(request);
      ZeroMemory(result);
      
      int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
      
      request.action = TRADE_ACTION_DEAL;
      request.symbol = symbol;
      request.volume = volume;
      request.type = (type == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
      request.price = (type == "BUY") ? SymbolInfoDouble(symbol, SYMBOL_ASK) : SymbolInfoDouble(symbol, SYMBOL_BID);
      request.price = NormalizeDouble(request.price, digits);
      request.deviation = MaxSlippage;
      request.magic = 123456;
      
      // Dynamic Filling Mode Resolution
      uint filling = (uint)SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
      if((filling & SYMBOL_FILLING_FOK) != 0) request.type_filling = ORDER_FILLING_FOK;
      else if((filling & SYMBOL_FILLING_IOC) != 0) request.type_filling = ORDER_FILLING_IOC;
      else request.type_filling = ORDER_FILLING_RETURN;
      
      // --- Dynamic Broker StopLevel Protection Cushion ---
      double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
      int stopLevelPoints = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
      double stopLevelPrice = stopLevelPoints * point;
      if(stopLevelPrice <= 0) {
         double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
         double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
         double spread = ask - bid;
         stopLevelPrice = (spread > 0) ? spread * 1.5 : 10 * point;
      }
      // Add a tiny extra safety margin (5 points) to guarantee broker compliance
      double safetyCushion = 5 * point;
      stopLevelPrice += safetyCushion;
      
      if(type == "BUY")
      {
         if(sl_points > 0)
         {
            double maxSL = request.price - stopLevelPrice;
            request.sl = (sl_points > maxSL) ? maxSL : sl_points;
            request.sl = NormalizeDouble(request.sl, digits);
         }
         if(tp_points > 0)
         {
            double minTP = request.price + stopLevelPrice;
            request.tp = (tp_points < minTP) ? minTP : tp_points;
            request.tp = NormalizeDouble(request.tp, digits);
         }
      }
      else if(type == "SELL")
      {
         if(sl_points > 0)
         {
            double minSL = request.price + stopLevelPrice;
            request.sl = (sl_points < minSL) ? minSL : sl_points;
            request.sl = NormalizeDouble(request.sl, digits);
         }
         if(tp_points > 0)
         {
            double maxTP = request.price - stopLevelPrice;
            request.tp = (tp_points > maxTP) ? maxTP : tp_points;
            request.tp = NormalizeDouble(request.tp, digits);
         }
      }
      
      bool success = OrderSend(request, result);
      
      string reply = "";
      if(success && (result.retcode == TRADE_RETCODE_DONE || result.retcode == TRADE_RETCODE_PLACED))
      {
         double fillPrice = (result.price > 0) ? result.price : request.price;
         reply = "{\"event\":\"trade_response\",\"id\":\"" + reqId + "\",\"success\":true,\"ticket\":" + IntegerToString(result.deal) + ",\"price\":" + DoubleToJSON(fillPrice, digits) + "}";
         Print("[BRIDGE] ✓ Order executed successfully! Deal Ticket: ", result.deal);
      }
      else
      {
         string err_msg = "Retcode: " + IntegerToString(result.retcode);
         reply = "{\"event\":\"trade_response\",\"id\":\"" + reqId + "\",\"success\":false,\"error\":\"" + err_msg + "\"}";
         Print("[BRIDGE] ❌ Order execution failed: ", err_msg);
      }
      SendWebSocketFrame(reply);
   }
   else if(StringFind(json, "\"action\":\"close\"") >= 0)
   {
      string reqId = ExtractJsonValue(json, "\"id\"");
      ulong ticket = StringToInteger(ExtractJsonValue(json, "\"ticket\""));
      double volume = StringToDouble(ExtractJsonValue(json, "\"volume\""));
      
      Print("[BRIDGE] 📥 Close Position Command Received: Ticket ", ticket, ", Volume: ", volume);
      
      MqlTradeRequest request;
      MqlTradeResult result;
      ZeroMemory(request);
      ZeroMemory(result);
      
      if(PositionSelectByTicket(ticket))
      {
         string symbol = PositionGetString(POSITION_SYMBOL);
         long type = PositionGetInteger(POSITION_TYPE);
         double pos_vol = PositionGetDouble(POSITION_VOLUME);
         int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
         
         if(volume <= 0 || volume > pos_vol) volume = pos_vol;
         
         request.action = TRADE_ACTION_DEAL;
         request.position = ticket;
         request.symbol = symbol;
         request.volume = volume;
         request.type = (type == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
         request.price = (type == POSITION_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
         request.price = NormalizeDouble(request.price, digits);
         request.deviation = MaxSlippage; // Fixed: Use dynamic MaxSlippage instead of hardcoded 10
         request.magic = 123456;
         
         uint filling = (uint)SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
         if((filling & SYMBOL_FILLING_FOK) != 0) request.type_filling = ORDER_FILLING_FOK;
         else if((filling & SYMBOL_FILLING_IOC) != 0) request.type_filling = ORDER_FILLING_IOC;
         else request.type_filling = ORDER_FILLING_RETURN;
         
         double profit = PositionGetDouble(POSITION_PROFIT);
         
         bool success = OrderSend(request, result);
         
         string reply = "";
         if(success && (result.retcode == TRADE_RETCODE_DONE || result.retcode == TRADE_RETCODE_PLACED))
         {
            double fillPrice = (result.price > 0) ? result.price : request.price;
            reply = "{\"event\":\"trade_response\",\"id\":\"" + reqId + "\",\"success\":true,\"ticket\":" + IntegerToString(ticket) + 
                    ",\"price\":" + DoubleToJSON(fillPrice, digits) + ",\"profit\":" + DoubleToJSON(profit, 2) + ",\"is_close\":true}";
            Print("[BRIDGE] ✓ Position closed successfully! Profit: ", profit);
         }
         else
         {
            reply = "{\"event\":\"trade_response\",\"id\":\"" + reqId + "\",\"success\":false,\"error\":\"Retcode " + IntegerToString(result.retcode) + "\"}";
            Print("[BRIDGE] ❌ Close failed: Retcode ", result.retcode);
         }
         SendWebSocketFrame(reply);
      }
      else
      {
         string reply = "{\"event\":\"trade_response\",\"id\":\"" + reqId + "\",\"success\":false,\"error\":\"Position select failed: Ticket not found or already closed.\"}";
         SendWebSocketFrame(reply);
         Print("[BRIDGE] ❌ Close failed: Ticket ", ticket, " not found.");
      }
   }
   else if(StringFind(json, "\"action\":\"modify_sl\"") >= 0)
   {
      ulong ticket = StringToInteger(ExtractJsonValue(json, "\"ticket\""));
      double newSL = StringToDouble(ExtractJsonValue(json, "\"sl\""));
      if(PositionSelectByTicket(ticket)) {
         string symbol = PositionGetString(POSITION_SYMBOL);
         long posType  = PositionGetInteger(POSITION_TYPE);
         double currentSL = PositionGetDouble(POSITION_SL);
         double currentTP = PositionGetDouble(POSITION_TP);
         
         double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
         double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
         double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
         int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
         int stopLevelPoints = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
         
         // 1. Calculate broker stop level buffer in price units
         double stopLevelPrice = stopLevelPoints * point;
         if(stopLevelPrice <= 0) {
            double spread = ask - bid;
            stopLevelPrice = (spread > 0) ? spread * 1.5 : 10 * point;
         }
         
         // Add a tiny extra fractional safety cushion (5 points) to guarantee broker acceptance
         double safetyCushion = 5 * point;
         stopLevelPrice += safetyCushion;
         
         double adjustedSL = newSL;
         bool isValid = true;
         
         // 2. Programmatically enforce StopLevel and Trade Direction rules
         if(posType == POSITION_TYPE_BUY) {
            double maxAllowedSL = bid - stopLevelPrice;
            if(adjustedSL > maxAllowedSL) {
               adjustedSL = maxAllowedSL;
            }
            // Ensure adjustedSL is normalized and actually better than currentSL
            adjustedSL = NormalizeDouble(adjustedSL, digits);
            if(adjustedSL <= 0 || (currentSL > 0 && adjustedSL <= currentSL)) {
               isValid = false;
            }
         } else if(posType == POSITION_TYPE_SELL) {
            double minAllowedSL = ask + stopLevelPrice;
            if(adjustedSL < minAllowedSL) {
               adjustedSL = minAllowedSL;
            }
            // Ensure adjustedSL is normalized and actually better (lower) than currentSL
            adjustedSL = NormalizeDouble(adjustedSL, digits);
            if(adjustedSL <= 0 || (currentSL > 0 && adjustedSL >= currentSL)) {
               isValid = false;
            }
         }
         
         if(!isValid) {
            Print("[BRIDGE] ⚠️ SL Modification skipped to prevent 10016 error. CurrentSL: ", DoubleToString(currentSL, digits), " RequestedSL: ", DoubleToString(newSL, digits), " AdjustedSL: ", DoubleToString(adjustedSL, digits), " (No improvement or too close to current price)");
            return;
         }
         
         MqlTradeRequest req; MqlTradeResult res;
         ZeroMemory(req); ZeroMemory(res);
         req.action   = TRADE_ACTION_SLTP;
         req.position = ticket;
         req.symbol   = symbol;
         req.sl       = adjustedSL;
         req.tp       = currentTP;
         
         bool success = OrderSend(req, res);
         if(success && (res.retcode == TRADE_RETCODE_DONE || res.retcode == TRADE_RETCODE_PLACED)) {
            Print("[BRIDGE] ✓ SL Modified successfully: Ticket=", ticket, " RequestedSL=", DoubleToString(newSL, digits), " AppliedSL=", DoubleToString(adjustedSL, digits));
         } else {
            Print("[BRIDGE] ❌ SL Modification failed: Ticket=", ticket, " AppliedSL=", DoubleToString(adjustedSL, digits), " Retcode=", res.retcode);
         }
      }
   }
   else if(StringFind(json, "\"action\":\"set_symbols\"") >= 0)
   {
      string symbols_str = ExtractJsonValue(json, "\"symbols\"");
      m_symbols_count = StringSplit(symbols_str, ',', m_symbols_to_track);
      
      ArrayResize(m_last_bids, m_symbols_count);
      ArrayResize(m_last_asks, m_symbols_count);
      ArrayInitialize(m_last_bids, 0.0);
      ArrayInitialize(m_last_asks, 0.0);
      
      Print("[BRIDGE] 📥 Multi-symbol tracking initialized for ", m_symbols_count, " symbols: ", symbols_str);
      
      for(int i = 0; i < m_symbols_count; i++)
      {
         if(i >= ArraySize(m_symbols_to_track))
         {
            Print("[BRIDGE] ⚠️ Array bounds exceeded at index ", i);
            break;
         }
         
         string sym = m_symbols_to_track[i];
         string resolved = ResolveBrokerSymbol(sym);
         
         if(resolved != "")
         {
            m_symbols_to_track[i] = resolved;
            Print("[BRIDGE] Symbol verified and selected: ", sym, " -> Resolved as: ", resolved);
         }
         else
         {
            Print("[BRIDGE] ❌ Failed to find symbol in MT5 Market Watch or broker database: ", sym);
         }
      }
   }
   else if(StringFind(json, "\"action\":\"get_symbols\"") >= 0)
   {
      SendAvailableSymbols();
   }
}

//+------------------------------------------------------------------+
//| Robust JSON helper to extract string & numeric values             |
//| Parses fields cleanly whether enclosed in quotes or raw numbers   |
//+------------------------------------------------------------------+
string ExtractJsonValue(string json, string key)
{
   int idx = StringFind(json, key);
   if(idx < 0) return "";
   
   int val_idx = idx + StringLen(key);
   
   // Find the colon `:` after the key
   while(val_idx < StringLen(json) && StringSubstr(json, val_idx, 1) != ":")
   {
      val_idx++;
   }
   if(val_idx >= StringLen(json)) return "";
   val_idx++; // Move past colon
   
   // Skip leading spaces
   while(val_idx < StringLen(json) && StringSubstr(json, val_idx, 1) == " ")
   {
      val_idx++;
   }
   if(val_idx >= StringLen(json)) return "";
   
   // Check if the value is a string (starts with a quote)
   bool is_string = (StringSubstr(json, val_idx, 1) == "\"");
   if(is_string)
   {
      val_idx++; // Skip opening quote
      int end_idx = val_idx;
      // Scan until the closing quote, ignoring commas
      while(end_idx < StringLen(json))
      {
         if(StringSubstr(json, end_idx, 1) == "\"") break;
         end_idx++;
      }
      return StringSubstr(json, val_idx, end_idx - val_idx);
   }
   else
   {
      // It's a raw number or boolean, scan until comma, closing brace, or space
      int end_idx = val_idx;
      while(end_idx < StringLen(json))
      {
         string char_at = StringSubstr(json, end_idx, 1);
         if(char_at == "," || char_at == "}" || char_at == " " || char_at == "\r" || char_at == "\n") break;
         end_idx++;
      }
      return StringSubstr(json, val_idx, end_idx - val_idx);
   }
}

//+------------------------------------------------------------------+
//| Bulletproof Double-to-JSON String formatter                      |
//| Replaces decimal commas with dots to prevent JSON parse errors   |
//+------------------------------------------------------------------+
string DoubleToJSON(double val, int digits)
{
   string s = DoubleToString(val, digits);
   StringReplace(s, ",", ".");
   return s;
}

//+------------------------------------------------------------------+
//| Fetch and transmit all available symbols on the MT5 terminal     |
//+------------------------------------------------------------------+
void SendAvailableSymbols()
{
   int total = SymbolsTotal(false);
   
   if(total < 5)
   {
      total = SymbolsTotal(true);
   }
   
   string symbols_list = "";
   int added = 0;
   
   for(int i = 0; i < total && added < 400; i++)
   {
      string name = SymbolName(i, (SymbolsTotal(false) < 5));
      if(name == "") continue;
      
      if(added > 0) symbols_list += ",";
      symbols_list += name;
      added++;
   }
   
   string payload = "{\"event\":\"mt5_symbols\",\"symbols\":\"" + symbols_list + "\"}";
   SendWebSocketFrame(payload);
   Print("[BRIDGE] 📤 Broadcasted ", added, " available symbols to local bridge.");
}
