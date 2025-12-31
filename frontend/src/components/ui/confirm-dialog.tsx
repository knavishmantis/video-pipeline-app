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

  const buttonStyles = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full ${
                variant === 'danger' ? 'bg-red-100' : 'bg-blue-100'
              } flex items-center justify-center`}>
                <IconAlertTriangle className={`h-6 w-6 ${
                  variant === 'danger' ? 'text-red-600' : 'text-blue-600'
                }`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold mb-2 text-neutral-900">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-700 whitespace-pre-line">
                  {message}
                </p>
              </div>
              
              <button
                onClick={onClose}
                className="flex-shrink-0 text-neutral-400 hover:text-neutral-600 transition-colors p-1 hover:bg-neutral-100 rounded-lg"
                aria-label="Close"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors font-medium text-sm"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-white rounded-lg transition-all font-medium text-sm shadow-sm hover:shadow-md ${buttonStyles} transform hover:scale-[1.02] active:scale-[0.98]`}
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

