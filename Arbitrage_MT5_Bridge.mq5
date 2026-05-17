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
//| Handle trade execution and close commands received from Node server|
//+------------------------------------------------------------------+
void ProcessCommand(string json)
{
   if(StringFind(json, "\"action\":\"trade\"") >= 0)
   {
      string reqId = ExtractJsonValue(json, "\"id\"");
      string symbol = ExtractJsonValue(json, "\"symbol\"");
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
      
      if(sl_points > 0)
      {
         request.sl = NormalizeDouble(sl_points, digits);
      }
      if(tp_points > 0)
      {
         request.tp = NormalizeDouble(tp_points, digits);
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
         MqlTradeRequest req; MqlTradeResult res;
         ZeroMemory(req); ZeroMemory(res);
         req.action   = TRADE_ACTION_SLTP;
         req.position = ticket;
         req.symbol   = PositionGetString(POSITION_SYMBOL);
         req.sl       = NormalizeDouble(newSL, (int)SymbolInfoInteger(req.symbol, SYMBOL_DIGITS));
         req.tp       = PositionGetDouble(POSITION_TP);
         
         bool success = OrderSend(req, res);
         if(success) {
            Print("[BRIDGE] SL Modified successfully: Ticket=", ticket, " NewSL=", newSL);
         } else {
            Print("[BRIDGE] ❌ SL Modification failed: Ticket=", ticket, " Retcode=", res.retcode);
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
         StringTrimLeft(m_symbols_to_track[i]);
         StringTrimRight(m_symbols_to_track[i]);
         
         string sym = m_symbols_to_track[i];
         
         if(SymbolSelect(sym, true))
         {
            Print("[BRIDGE] Symbol verified and selected: ", sym);
            continue;
         }
         
         string sym_suffix = sym + ".m";
         if(SymbolSelect(sym_suffix, true))
         {
            Print("[BRIDGE] Symbol auto-matched with suffix: ", sym, " -> ", sym_suffix);
            m_symbols_to_track[i] = sym_suffix;
            continue;
         }
         
         string sym_nospace = sym;
         StringReplace(sym_nospace, " ", "");
         if(SymbolSelect(sym_nospace, true))
         {
            Print("[BRIDGE] Symbol auto-matched without spaces: ", sym, " -> ", sym_nospace);
            m_symbols_to_track[i] = sym_nospace;
            continue;
         }
         
         string sym_nospace_suffix = sym_nospace + ".m";
         if(SymbolSelect(sym_nospace_suffix, true))
         {
            Print("[BRIDGE] Symbol auto-matched with no spaces and suffix: ", sym, " -> ", sym_nospace_suffix);
            m_symbols_to_track[i] = sym_nospace_suffix;
            continue;
         }
         
         Print("[BRIDGE] ❌ Failed to find symbol in MT5 Market Watch: ", sym);
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
   // Skip spaces, colons and quotes
   while(val_idx < StringLen(json) && (StringSubstr(json, val_idx, 1) == " " || StringSubstr(json, val_idx, 1) == ":" || StringSubstr(json, val_idx, 1) == "\""))
   {
      val_idx++;
   }
   
   int end_idx = val_idx;
   // Scan until we hit a delimiter (quote, comma, or closing curly brace)
   while(end_idx < StringLen(json))
   {
      string char_at = StringSubstr(json, end_idx, 1);
      if(char_at == "\"" || char_at == "," || char_at == "}")
      {
         break;
      }
      end_idx++;
   }
   
   return StringSubstr(json, val_idx, end_idx - val_idx);
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
