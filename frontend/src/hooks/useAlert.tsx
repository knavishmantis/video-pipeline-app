import { useState, useCallback } from 'react';
import { AlertDialog } from '../components/ui/alert-dialog';

interface AlertOptions {
  title?: string;
  type?: 'warning' | 'error' | 'info' | 'success';
}

export function useAlert() {
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    message: string;
    title?: string;
    type?: 'warning' | 'error' | 'info' | 'success';
  }>({
    isOpen: false,
    message: '',
    type: 'warning',
  });

  const showAlert = useCallback((message: string, options?: AlertOptions) => {
    setAlertState({
      isOpen: true,
      message,
      title: options?.title,
      type: options?.type || 'warning',
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const AlertComponent = () => (
    <AlertDialog
      isOpen={alertState.isOpen}
      onClose={hideAlert}
      message={alertState.message}
      title={alertState.title}
      type={alertState.type}
    />
  );

  return { showAlert, AlertComponent };
}

