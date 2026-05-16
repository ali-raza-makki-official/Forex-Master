'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { CheckCircle, AlertCircle, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }].slice(-3)); // Max 3
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`pointer-events-auto min-w-[300px] p-4 rounded-xl border shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-right duration-300 ${
              toast.type === 'success' ? 'bg-[#00d4a8]/10 border-[#00d4a8]/20 text-[#00d4a8]' :
              toast.type === 'warning' ? 'bg-[#f5a623]/10 border-[#f5a623]/20 text-[#f5a623]' :
              'bg-[#ff4757]/10 border-[#ff4757]/20 text-[#ff4757]'
            }`}
          >
            <div className="flex items-center gap-3">
              {toast.type === 'success' && <CheckCircle size={18} />}
              {toast.type === 'warning' && <AlertCircle size={18} />}
              {toast.type === 'error' && <XCircle size={18} />}
              <span className="text-sm font-bold">{toast.message}</span>
            </div>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="opacity-50 hover:opacity-100 transition-opacity"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
