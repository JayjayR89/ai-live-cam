import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Show toast notification for user feedback
    toast({
      title: "Application Error",
      description: "Something went wrong. The error has been logged and you can try refreshing the component.",
      variant: "destructive",
      duration: 5000
    });

    // Report error to monitoring service (if available)
    this.reportError(error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;
    
    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetKeys && resetKeys.length > 0) {
        // Check if any reset key has changed
        const hasResetKeyChanged = resetKeys.some((key, index) => 
          prevProps.resetKeys?.[index] !== key
        );
        
        if (hasResetKeyChanged) {
          this.resetErrorBoundary();
        }
      }
    }

    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to your error reporting service
    // For now, we'll just log it with additional context
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorId: this.state.errorId
    };

    console.error('Error Report:', errorReport);
    
    // You could send this to services like Sentry, LogRocket, etc.
    // Example: Sentry.captureException(error, { contexts: { errorInfo } });
  };

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  private handleRetry = () => {
    this.resetErrorBoundary();
    
    toast({
      title: "Component Reset",
      description: "The component has been reset. Please try your action again.",
      duration: 3000
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Card className="p-6 m-4 border-destructive">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-full">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-destructive">
                Something went wrong
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                An unexpected error occurred in this component. You can try refreshing the component or reload the page.
              </p>
            </div>

            {/* Error details for development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="w-full max-w-md">
                <summary className="text-sm font-medium cursor-pointer hover:text-primary">
                  Error Details (Development)
                </summary>
                <div className="mt-2 p-3 bg-muted rounded text-xs font-mono text-left overflow-auto max-h-40">
                  <div className="text-destructive font-semibold mb-2">
                    {this.state.error.name}: {this.state.error.message}
                  </div>
                  <div className="whitespace-pre-wrap text-muted-foreground">
                    {this.state.error.stack}
                  </div>
                  {this.state.errorInfo && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-destructive font-semibold mb-1">Component Stack:</div>
                      <div className="whitespace-pre-wrap text-muted-foreground">
                        {this.state.errorInfo.componentStack}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={this.handleRetry}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              
              <Button 
                onClick={this.handleReload}
                variant="default"
                size="sm"
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Reload Page
              </Button>
            </div>

            {/* Error ID for support */}
            <div className="text-xs text-muted-foreground">
              Error ID: {this.state.errorId}
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) => {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} ref={ref} />
    </ErrorBoundary>
  ));

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Specialized error boundaries for specific components
export const TTSErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      console.error('TTS Component Error:', error, errorInfo);
      toast({
        title: "TTS Error",
        description: "Text-to-speech functionality encountered an error. Please try again.",
        variant: "destructive",
        duration: 4000
      });
    }}
    fallback={
      <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
        <span className="text-sm text-destructive">TTS unavailable</span>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

export const AnimationErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      console.error('Animation Component Error:', error, errorInfo);
      toast({
        title: "Animation Error",
        description: "Animation functionality encountered an error. Continuing without animations.",
        variant: "destructive",
        duration: 3000
      });
    }}
    fallback={
      <div className="transition-opacity duration-200">
        {children}
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);