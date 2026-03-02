import { IconX, IconCircleCheck, IconAlertCircle, IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        onRemove(toast.id);
      }, toast.duration !== undefined ? toast.duration : (toast.type === 'success' ? 2000 : 5000));
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, toast.duration]);

  const typeConfig = {
    success: {
      iconColor: 'var(--green)',
      accentBg: 'var(--green-dim, rgba(74,167,74,0.1))',
      accentBorder: 'var(--green-dim-border, rgba(74,167,74,0.25))',
      iconComponent: IconCircleCheck,
    },
    error: {
      iconColor: '#e05a4e',
      accentBg: 'rgba(224,90,78,0.1)',
      accentBorder: 'rgba(224,90,78,0.25)',
      iconComponent: IconAlertCircle,
    },
    info: {
      iconColor: 'var(--blue)',
      accentBg: 'var(--blue-dim, rgba(59,130,246,0.1))',
      accentBorder: 'var(--blue-dim-border, rgba(59,130,246,0.25))',
      iconComponent: IconInfoCircle,
    },
    warning: {
      iconColor: 'var(--gold)',
      accentBg: 'var(--gold-dim)',
      accentBorder: 'var(--gold-border)',
      iconComponent: IconAlertTriangle,
    },
  };

  const config = typeConfig[toast.type];
  const IconComponent = config.iconComponent;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderLeft: `3px solid ${config.iconColor}`,
        borderRadius: '8px',
        boxShadow: 'var(--shadow-md)',
        padding: '12px 14px',
        minWidth: '280px',
        maxWidth: '380px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}
    >
      <IconComponent className="h-4 w-4 flex-shrink-0" style={{ color: config.iconColor, marginTop: '1px' }} />
      <p style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5', margin: 0 }}>{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        style={{ flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)', borderRadius: '4px', transition: 'color 0.15s ease' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        aria-label="Close"
      >
        <IconX className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-[3000] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={onRemove} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
