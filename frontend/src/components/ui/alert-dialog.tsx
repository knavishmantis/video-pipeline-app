import { IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconAlertCircle, IconX } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'warning' | 'error' | 'info' | 'success';
}

export function AlertDialog({ isOpen, onClose, title, message, type = 'warning' }: AlertDialogProps) {
  const typeStyles = {
    warning: {
      iconBg: 'bg-amber-100',
      icon: 'text-amber-600',
      iconComponent: IconAlertTriangle,
    },
    error: {
      iconBg: 'bg-red-100',
      icon: 'text-red-600',
      iconComponent: IconAlertCircle,
    },
    info: {
      iconBg: 'bg-blue-100',
      icon: 'text-blue-600',
      iconComponent: IconInfoCircle,
    },
    success: {
      iconBg: 'bg-green-100',
      icon: 'text-green-600',
      iconComponent: IconCircleCheck,
    },
  };

  const styles = typeStyles[type];
  const IconComponent = styles.iconComponent;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
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
              {/* Icon with background circle */}
              <div className={`flex-shrink-0 w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center`}>
                <IconComponent className={`h-6 w-6 ${styles.icon}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 className="text-lg font-semibold mb-2 text-neutral-900">
                    {title}
                  </h3>
                )}
                <p className="text-sm leading-relaxed text-neutral-700 whitespace-pre-line">
                  {message.replace(/\. /g, '.\n')}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

