import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, X, Info } from 'lucide-react';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const iconColors = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

export function Toast({ message, type = 'error', onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose?.(), 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const Icon = icons[type] || icons.info;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg transition-all duration-300 ${styles[type]} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${iconColors[type]}`} />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button onClick={() => { setVisible(false); setTimeout(() => onClose?.(), 300); }} className="p-0.5 rounded-lg hover:bg-black/5 shrink-0">
        <X className="w-4 h-4 opacity-50" />
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 w-96 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

let _toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'error') => {
    const id = ++_toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
    info: (msg) => addToast(msg, 'info'),
  };

  return { toasts, removeToast, toast };
}
