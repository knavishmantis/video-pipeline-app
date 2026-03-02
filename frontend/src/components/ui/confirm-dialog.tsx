import { IconAlertTriangle, IconX } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
          style={{ background: 'var(--modal-overlay)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: 'var(--bg-surface)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-default)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                flexShrink: 0,
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: variant === 'danger' ? 'rgba(224,90,78,0.1)' : 'var(--gold-dim)',
                border: variant === 'danger' ? '1px solid rgba(224,90,78,0.3)' : '1px solid var(--gold-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <IconAlertTriangle
                  className="h-5 w-5"
                  style={{ color: variant === 'danger' ? '#e05a4e' : 'var(--gold)' }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                  {title}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                  {message}
                </p>
              </div>

              <button
                onClick={onClose}
                style={{ flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', color: 'var(--text-muted)', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                aria-label="Close"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                onClick={onClose}
                style={{ padding: '0 16px', height: '36px', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '0 16px',
                  height: '36px',
                  borderRadius: '8px',
                  background: variant === 'danger' ? '#e05a4e' : 'var(--gold)',
                  color: 'var(--bg-surface)',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  letterSpacing: '-0.01em',
                  transition: 'all 0.15s ease',
                }}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
