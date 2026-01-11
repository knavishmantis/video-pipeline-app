/**
 * Safely extracts an error message from an unknown error object
 */
export function getErrorMessage(error: unknown, defaultMessage = 'An error occurred'): string {
  // Handle axios errors first (check response.data.error before error.message)
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: unknown }).response;
    if (response && typeof response === 'object' && 'data' in response) {
      const data = (response as { data?: unknown }).data;
      if (data && typeof data === 'object' && 'error' in data) {
        const errorMsg = (data as { error?: unknown }).error;
        if (typeof errorMsg === 'string') {
          return errorMsg;
        }
      }
    }
  }
  
  // Fallback to error.message if it's an Error instance
  if (error instanceof Error) {
    return error.message;
  }
  
  return defaultMessage;
}

