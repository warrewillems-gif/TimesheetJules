import { useState, useEffect, useCallback } from 'react';

export interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success';
}

let toastId = 0;
let listeners: Array<(toast: Toast) => void> = [];

export function showToast(message: string, type: 'error' | 'success' = 'error') {
  const toast: Toast = { id: ++toastId, message, type };
  listeners.forEach(fn => fn(toast));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Toast) => {
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 4000);
  }, []);

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      listeners = listeners.filter(fn => fn !== addToast);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm text-white animate-slide-in ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}
          onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
