import { toast } from '@/hooks/use-toast';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  timestamp?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'tts' | 'animation' | 'camera' | 'network' | 'configuration' | 'unknown';
}

class ErrorHandler {
  private errorQueue: ErrorReport[] = [];
  private maxQueueSize = 50;
  private reportingEnabled = true;

  // Error categorization patterns
  private errorPatterns = {
    tts: [
      /tts|text.to.speech|speech|voice|audio/i,
      /insufficient.funds|quota|billing/i,
      /puter\.ai\.txt2speech/i
    ],
    animation: [
      /animation|transition|transform|css/i,
      /requestAnimationFrame|performance/i
    ],
    camera: [
      /camera|video|stream|media|getUserMedia/i,
      /NotAllowedError|NotFoundError|NotReadableError/i
    ],
    network: [
      /network|fetch|xhr|connection|timeout/i,
      /NetworkError|TypeError.*fetch/i
    ],
    configuration: [
      /config|settings|localStorage|invalid/i
    ]
  };

  // Severity determination based on error characteristics
  private determineSeverity(error: Error, context: ErrorContext): ErrorReport['severity'] {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    // Critical errors that break core functionality
    if (
      message.includes('chunk') ||
      message.includes('module') ||
      stack.includes('componentDidCatch') ||
      context.component === 'CameraAIApp'
    ) {
      return 'critical';
    }
    
    // High severity for user-facing features
    if (
      context.component === 'TTSControls' ||
      context.component === 'CameraPreview' ||
      message.includes('permission') ||
      message.includes('access denied')
    ) {
      return 'high';
    }
    
    // Medium for non-critical features
    if (
      context.component === 'AnimationWrapper' ||
      message.includes('animation') ||
      message.includes('transition')
    ) {
      return 'medium';
    }
    
    return 'low';
  }

  // Categorize error based on patterns
  private categorizeError(error: Error): ErrorReport['category'] {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    const fullText = `${message} ${stack}`;
    
    for (const [category, patterns] of Object.entries(this.errorPatterns)) {
      if (patterns.some(pattern => pattern.test(fullText))) {
        return category as ErrorReport['category'];
      }
    }
    
    return 'unknown';
  }

  // Generate user-friendly error messages
  private generateUserMessage(error: Error, category: ErrorReport['category']): string {
    const message = error.message.toLowerCase();
    
    switch (category) {
      case 'tts':
        if (message.includes('insufficient') || message.includes('quota')) {
          return 'TTS service quota exceeded. Using browser speech as fallback.';
        }
        if (message.includes('network') || message.includes('connection')) {
          return 'Network error prevented TTS. Please check your connection.';
        }
        if (message.includes('voice') || message.includes('engine')) {
          return 'Selected voice unavailable. Switching to default voice.';
        }
        return 'TTS service temporarily unavailable. Please try again.';
        
      case 'animation':
        if (message.includes('performance') || message.includes('frame')) {
          return 'Animation performance issues detected. Reducing animation complexity.';
        }
        return 'Animation error occurred. Continuing without animations.';
        
      case 'camera':
        if (message.includes('permission') || message.includes('NotAllowedError')) {
          return 'Camera permission denied. Please allow camera access in your browser.';
        }
        if (message.includes('NotFoundError')) {
          return 'No camera found. Please connect a camera and try again.';
        }
        if (message.includes('NotReadableError')) {
          return 'Camera is being used by another application.';
        }
        return 'Camera error occurred. Please try refreshing the page.';
        
      case 'network':
        if (message.includes('timeout')) {
          return 'Request timed out. Please check your internet connection.';
        }
        if (message.includes('fetch')) {
          return 'Network request failed. Please try again.';
        }
        return 'Network error occurred. Please check your connection.';
        
      case 'configuration':
        return 'Configuration error detected. Settings have been reset to defaults.';
        
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  // Main error handling method
  public handleError(
    error: Error,
    context: ErrorContext = {},
    showToast: boolean = true
  ): string {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(error, context);
    const userMessage = this.generateUserMessage(error, category);
    
    const errorReport: ErrorReport = {
      id: errorId,
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        timestamp: new Date().toISOString()
      },
      severity,
      category
    };
    
    // Add to error queue
    this.addToQueue(errorReport);
    
    // Log error with context
    console.error(`[${category.toUpperCase()}] ${severity.toUpperCase()}:`, {
      errorId,
      message: error.message,
      context,
      stack: error.stack
    });
    
    // Show user notification if requested
    if (showToast) {
      this.showUserNotification(userMessage, severity, category);
    }
    
    // Report to external services in production
    if (process.env.NODE_ENV === 'production' && this.reportingEnabled) {
      this.reportToExternalService(errorReport);
    }
    
    return errorId;
  }

  // Show appropriate user notification
  private showUserNotification(
    message: string,
    severity: ErrorReport['severity'],
    category: ErrorReport['category']
  ) {
    const isDestructive = severity === 'high' || severity === 'critical';
    const duration = severity === 'critical' ? 8000 : severity === 'high' ? 5000 : 3000;
    
    const titles = {
      tts: 'TTS Error',
      animation: 'Animation Error',
      camera: 'Camera Error',
      network: 'Network Error',
      configuration: 'Configuration Error',
      unknown: 'Application Error'
    };
    
    toast({
      title: titles[category],
      description: message,
      variant: isDestructive ? 'destructive' : 'default',
      duration
    });
  }

  // Add error to queue with size management
  private addToQueue(errorReport: ErrorReport) {
    this.errorQueue.unshift(errorReport);
    
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue = this.errorQueue.slice(0, this.maxQueueSize);
    }
  }

  // Report to external monitoring service
  private reportToExternalService(errorReport: ErrorReport) {
    // In a real application, you would send this to your monitoring service
    // Examples: Sentry, LogRocket, Bugsnag, etc.
    
    try {
      // Example implementation:
      // Sentry.captureException(new Error(errorReport.message), {
      //   tags: {
      //     category: errorReport.category,
      //     severity: errorReport.severity
      //   },
      //   contexts: {
      //     errorReport: errorReport.context
      //   }
      // });
      
      console.log('Would report to external service:', errorReport);
    } catch (reportingError) {
      console.error('Failed to report error to external service:', reportingError);
    }
  }

  // Get recent errors for debugging
  public getRecentErrors(limit: number = 10): ErrorReport[] {
    return this.errorQueue.slice(0, limit);
  }

  // Clear error queue
  public clearErrors(): void {
    this.errorQueue = [];
  }

  // Enable/disable external reporting
  public setReportingEnabled(enabled: boolean): void {
    this.reportingEnabled = enabled;
  }

  // Get error statistics
  public getErrorStats(): {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const stats = {
      total: this.errorQueue.length,
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>
    };
    
    this.errorQueue.forEach(error => {
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });
    
    return stats;
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Convenience functions for common error scenarios
export const handleTTSError = (error: Error, context?: Partial<ErrorContext>) => {
  return errorHandler.handleError(error, {
    ...context,
    component: context?.component || 'TTSControls',
    action: context?.action || 'tts_playback'
  });
};

export const handleAnimationError = (error: Error, context?: Partial<ErrorContext>) => {
  return errorHandler.handleError(error, {
    ...context,
    component: context?.component || 'AnimationWrapper',
    action: context?.action || 'animation_playback'
  });
};

export const handleCameraError = (error: Error, context?: Partial<ErrorContext>) => {
  return errorHandler.handleError(error, {
    ...context,
    component: context?.component || 'CameraPreview',
    action: context?.action || 'camera_operation'
  });
};

export const handleConfigurationError = (error: Error, context?: Partial<ErrorContext>) => {
  return errorHandler.handleError(error, {
    ...context,
    component: context?.component || 'SettingsModal',
    action: context?.action || 'configuration_change'
  });
};

// Async error wrapper for promises
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  fallbackValue?: T
): Promise<T | undefined> => {
  try {
    return await operation();
  } catch (error) {
    errorHandler.handleError(error as Error, context);
    return fallbackValue;
  }
};

// React hook for error handling
export const useErrorHandler = () => {
  const handleError = (error: Error, context?: ErrorContext) => {
    return errorHandler.handleError(error, context);
  };
  
  const getRecentErrors = () => errorHandler.getRecentErrors();
  const clearErrors = () => errorHandler.clearErrors();
  const getErrorStats = () => errorHandler.getErrorStats();
  
  return {
    handleError,
    getRecentErrors,
    clearErrors,
    getErrorStats
  };
};