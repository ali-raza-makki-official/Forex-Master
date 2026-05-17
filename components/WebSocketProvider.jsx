'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from './ToastSystem';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const { addToast } = useToast();
  const [ws, setWs] = useState(null);
  const [prices, setPrices] = useState({});
  const [signals, setSignals] = useState([]);
  const [status, setStatus] = useState('Disconnected');
  const [positions, setPositions] = useState([]);
  const [lockStates, setLockStates] = useState({});
  const [balance, setBalance] = useState(0);
  const [equity, setEquity] = useState(0);
  const [hftAnalytics, setHftAnalytics] = useState([]);
  const [tradeStats, setTradeStats] = useState({ totalTrades: 0, tp: {count:0, pct:0}, sl: {count:0, pct:0}, be: {count:0, pct:0} });
  const [gapStats, setGapStats] = useState({ avgDiff: null, threshold: null });
  const [atr, setAtr] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [systemSettings, setSystemSettings] = useState({});
  const [newsStatus, setNewsStatus] = useState(null);
  const [dailyStats, setDailyStats] = useState(null);
  const [allSymbols, setAllSymbols] = useState([]); // List of all available symbols in MT5
  
  // GLOBAL PAIR CONFIGURATION (Purged defaults per user request)
  const [activePairs, setActivePairs] = useState([]);
  const [leaderPair, setLeaderPair] = useState({ symbol: 'XAUUSD', name: 'Gold Spot' });

  useEffect(() => {
    let retryDelay = 1000;
    const MAX_DELAY = 30000;
    let socket = null;
    let reconnectTimeout = null;

    function connect() {
      socket = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002');
      
      socket.onopen = () => {
        setStatus('Connected');
        setWs(socket);
        retryDelay = 1000; // reset delay on successful connection
      };
      
      socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'init') {
          setPrices(msg.prices);
        } else if (msg.event === 'price_update') {
          setPrices(prev => ({
            ...prev,
            [msg.symbol]: { bid: msg.bid, ask: msg.ask, time: msg.time }
          }));
        } else if (msg.event === 'new_signal') {
          setSignals(prev => [msg.signal, ...prev].slice(0, 5)); // Keep last 5 (Extract inner signal object)
        } else if (msg.event === 'heartbeat') {
          if (msg.positions) setPositions(msg.positions);
          if (msg.balance) setBalance(msg.balance);
          if (msg.equity) setEquity(msg.equity);
        } else if (msg.event === 'lock_update') {
          setLockStates(prev => ({
            ...prev,
            [msg.ticket]: {
              zone: msg.zone,
              profitPips: msg.profitPips,
              lockPips: msg.lockPips,
              lockPrice: msg.lockPrice,
              protectPct: msg.protectPct,
              nextLockPips: msg.nextLockPips,
              nextProtectPips: msg.nextProtectPips
            }
          }));
          
          if (msg.zoneChanged) {
            addToast(`🎯 ${msg.zoneEmoji || ''} Zone Upgrade! Trade #${msg.ticket} entered ${msg.zone}`, "success");
          }
        } else if (msg.event === 'mt5_status') {
          setStatus(msg.status);
          addToast(`MT5 Bridge ${msg.status}`, msg.status === 'Connected' ? 'success' : 'error');
        } else if (msg.event === 'partial_close') {
          addToast(`💰 Partial Close: ${msg.message}`, "success");
        } else if (msg.event === 'trade_response') {
          if (msg.success) {
            addToast(`${msg.type} ${msg.volume} ${msg.symbol} — Ticket #${msg.ticket}`, "success");
          } else {
            addToast(`Trade Failed: ${msg.error}`, "error");
          }
        } else if (msg.event === 'hft_analytics') {
          setHftAnalytics(msg.data);
          if (msg.tradeStats) setTradeStats(msg.tradeStats);
          if (msg.gapStats) setGapStats(msg.gapStats);
          if (msg.atr) setAtr(msg.atr);
          if (msg.historyLogs) setHistoryLogs(msg.historyLogs);
          if (msg.systemSettings) {
            // Merge systemSettings instead of overwriting to prevent UI parameter wiping
            setSystemSettings(prev => ({
              ...prev,
              ...msg.systemSettings
            }));
          }
          if (msg.newsStatus) setNewsStatus(msg.newsStatus);
          if (msg.dailyStats) setDailyStats(msg.dailyStats);
        } else if (msg.event === 'emergency_stop_confirmed') {
          addToast('🛑 EMERGENCY STOP EXECUTED — All systems paused', "error");
        } else if (msg.event === 'training_complete') {
          addToast('🧠 Neural Retraining Complete', "success");
          if (msg.weights) {
            setSystemSettings(prev => ({
              ...prev,
              trainingData: {
                ...prev.trainingData,
                weights: msg.weights,
                lastRetrain: new Date(msg.timestamp).toLocaleTimeString()
              }
            }));
          }
        } else if (msg.event === 'mt5_symbols') {
          let list = [];
          if (typeof msg.symbols === 'string') {
            list = msg.symbols.split(',').filter(s => s.trim() !== '');
          } else {
            list = msg.symbols || [];
          }
          setAllSymbols(list);
          if (list.length > 0) {
            addToast(`🔍 Discovery Complete: ${list.length} symbols loaded`, "success");
          }
        } else if (msg.event === 'architecture_sync') {
          console.log('🔄 Syncing Architecture from DB:', msg);
          if (msg.leader) {
            setLeaderPair({ symbol: msg.leader, name: msg.leader + ' Benchmark' });
          }
          if (msg.laggingPairs) {
            setActivePairs(msg.laggingPairs.map(p => ({ 
              symbol: p.symbol || p, 
              name: (p.symbol || p) + ' Market',
              correlation: p.correlation || 'same',
              weight: p.weight || 50
            })));
          }
        }
      } catch (err) {
        console.error('WS parse error', err);
      }
    };
    
    socket.onclose = () => {
      setStatus('Disconnected');
      setWs(null);
      reconnectTimeout = setTimeout(() => {
        retryDelay = Math.min(retryDelay * 2, MAX_DELAY);
        connect();
      }, retryDelay);
    };

    socket.onerror = () => {
      socket.close(); // trigger onclose to reconnect
    };
  }

  connect();

  return () => {
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (socket) socket.close();
  };
  }, []);

  const sendTradeCommand = (action, payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action, ...payload }));
    }
  };

  return (
    <WebSocketContext.Provider value={{ 
        ws, socket: ws, prices, signals, status, positions, balance, equity, 
        hftAnalytics, tradeStats, gapStats, atr, historyLogs, systemSettings, newsStatus, dailyStats,
        lockStates, activePairs, setActivePairs, leaderPair, setLeaderPair, allSymbols, sendTradeCommand 
      }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}
