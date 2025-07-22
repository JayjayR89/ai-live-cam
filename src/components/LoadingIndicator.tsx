import React from 'react';
import { Loader2, Zap, Volume2, Camera, Settings, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type LoadingType = 'default' | 'tts' | 'camera' | 'animation' | 'settings' | 'error';

interface LoadingIndicatorProps {
  type?: LoadingType;
  message?: string;
  subMessage?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showProgress?: boolean;
  progress?: number; // 0-100
  variant?: 'default' | 'overlay' | 'inline' | 'card';
}

const loadingConfig = {
  default: {
    icon: Loader2,
    color: 'text-primary',
    message: 'Loading...',
    subMessage: 'Please wait'
  },
  tts: {
    icon: Volume2,
    color: 'text-blue-500',
    message: 'Generating speech...',
    subMessage: 'Processing text-to-speech'
  },
  camera: {
    icon: Camera,
    color: 'text-green-500',
    message: 'Initializing camera...',
    subMessage: 'Accessing camera feed'
  },
  animation: {
    icon: Zap,
    color: 'text-purple-500',
    message: 'Processing animation...',
    subMessage: 'Applying visual effects'
  },
  settings: {
    icon: Settings,
    color: 'text-orange-500',
    message: 'Saving settings...',
    subMessage: 'Updating configuration'
  },
  error: {
    icon: AlertCircle,
    color: 'text-destructive',
    message: 'Error occurred',
    subMessage: 'Please try again'
  }
};

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  type = 'default',
  message,
  subMessage,
  size = 'md',
  className,
  showProgress = false,
  progress = 0,
  variant = 'default'
}) => {
  const config = loadingConfig[type];
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: {
      icon: 'h-4 w-4',
      text: 'text-sm',
      subText: 'text-xs',
      container: 'gap-2 p-2'
    },
    md: {
      icon: 'h-6 w-6',
      text: 'text-base',
      subText: 'text-sm',
      container: 'gap-3 p-4'
    },
    lg: {
      icon: 'h-8 w-8',
      text: 'text-lg',
      subText: 'text-base',
      container: 'gap-4 p-6'
    }
  };
  
  const sizes = sizeClasses[size];
  const displayMessage = message || config.message;
  const displaySubMessage = subMessage || config.subMessage;
  
  const content = (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      sizes.container,
      className
    )}>
      {/* Icon with animation */}
      <div className="relative">
        <Icon 
          className={cn(
            sizes.icon,
            config.color,
            type !== 'error' && 'animate-spin'
          )} 
        />
        
        {/* Pulse effect for non-spinning icons */}
        {type === 'error' && (
          <div className={cn(
            'absolute inset-0 rounded-full animate-ping opacity-25',
            config.color.replace('text-', 'bg-')
          )} />
        )}
      </div>
      
      {/* Text content */}
      <div className="space-y-1">
        <div className={cn('font-medium', sizes.text)}>
          {displayMessage}
        </div>
        
        {displaySubMessage && (
          <div className={cn('text-muted-foreground', sizes.subText)}>
            {displaySubMessage}
          </div>
        )}
      </div>
      
      {/* Progress bar */}
      {showProgress && (
        <div className="w-full max-w-xs">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className={cn(
                'h-full transition-all duration-300 ease-out rounded-full',
                config.color.replace('text-', 'bg-')
              )}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          <div className={cn('text-center mt-1', sizes.subText, 'text-muted-foreground')}>
            {Math.round(progress)}%
          </div>
        </div>
      )}
    </div>
  );
  
  // Render based on variant
  switch (variant) {
    case 'overlay':
      return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border rounded-lg shadow-lg">
            {content}
          </div>
        </div>
      );
      
    case 'inline':
      return (
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4 animate-spin', config.color)} />
          <span className="text-sm">{displayMessage}</span>
        </div>
      );
      
    case 'card':
      return (
        <div className="bg-card border rounded-lg shadow-sm">
          {content}
        </div>
      );
      
    default:
      return content;
  }
};

// Specialized loading components for common use cases
export const TTSLoadingIndicator: React.FC<Omit<LoadingIndicatorProps, 'type'>> = (props) => (
  <LoadingIndicator type="tts" {...props} />
);

export const CameraLoadingIndicator: React.FC<Omit<LoadingIndicatorProps, 'type'>> = (props) => (
  <LoadingIndicator type="camera" {...props} />
);

export const AnimationLoadingIndicator: React.FC<Omit<LoadingIndicatorProps, 'type'>> = (props) => (
  <LoadingIndicator type="animation" {...props} />
);

export const SettingsLoadingIndicator: React.FC<Omit<LoadingIndicatorProps, 'type'>> = (props) => (
  <LoadingIndicator type="settings" {...props} />
);

// Loading overlay hook for easy usage
export const useLoadingOverlay = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingConfig, setLoadingConfig] = React.useState<{
    type: LoadingType;
    message?: string;
    subMessage?: string;
    showProgress?: boolean;
    progress?: number;
  }>({
    type: 'default'
  });
  
  const showLoading = (config: typeof loadingConfig) => {
    setLoadingConfig(config);
    setIsLoading(true);
  };
  
  const hideLoading = () => {
    setIsLoading(false);
  };
  
  const updateProgress = (progress: number) => {
    setLoadingConfig(prev => ({ ...prev, progress }));
  };
  
  const LoadingOverlay = isLoading ? (
    <LoadingIndicator
      variant="overlay"
      {...loadingConfig}
    />
  ) : null;
  
  return {
    isLoading,
    showLoading,
    hideLoading,
    updateProgress,
    LoadingOverlay
  };
};

// Status message component for non-loading feedback
interface StatusMessageProps {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  subMessage?: string;
  className?: string;
  onDismiss?: () => void;
  autoHide?: boolean;
  duration?: number;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  type,
  message,
  subMessage,
  className,
  onDismiss,
  autoHide = false,
  duration = 3000
}) => {
  const [isVisible, setIsVisible] = React.useState(true);
  
  React.useEffect(() => {
    if (autoHide && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration, onDismiss]);
  
  if (!isVisible) return null;
  
  const typeConfig = {
    success: {
      bgColor: 'bg-green-50 dark:bg-green-950',
      borderColor: 'border-green-200 dark:border-green-800',
      textColor: 'text-green-800 dark:text-green-200',
      iconColor: 'text-green-600 dark:text-green-400'
    },
    warning: {
      bgColor: 'bg-yellow-50 dark:bg-yellow-950',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      textColor: 'text-yellow-800 dark:text-yellow-200',
      iconColor: 'text-yellow-600 dark:text-yellow-400'
    },
    error: {
      bgColor: 'bg-red-50 dark:bg-red-950',
      borderColor: 'border-red-200 dark:border-red-800',
      textColor: 'text-red-800 dark:text-red-200',
      iconColor: 'text-red-600 dark:text-red-400'
    },
    info: {
      bgColor: 'bg-blue-50 dark:bg-blue-950',
      borderColor: 'border-blue-200 dark:border-blue-800',
      textColor: 'text-blue-800 dark:text-blue-200',
      iconColor: 'text-blue-600 dark:text-blue-400'
    }
  };
  
  const config = typeConfig[type];
  
  return (
    <div className={cn(
      'p-3 rounded-md border',
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className="flex items-start gap-2">
        <div className={cn('flex-shrink-0 mt-0.5', config.iconColor)}>
          {type === 'success' && <Zap className="h-4 w-4" />}
          {type === 'warning' && <AlertCircle className="h-4 w-4" />}
          {type === 'error' && <AlertCircle className="h-4 w-4" />}
          {type === 'info' && <Loader2 className="h-4 w-4" />}
        </div>
        
        <div className="flex-1">
          <div className={cn('text-sm font-medium', config.textColor)}>
            {message}
          </div>
          {subMessage && (
            <div className={cn('text-xs mt-1 opacity-80', config.textColor)}>
              {subMessage}
            </div>
          )}
        </div>
        
        {onDismiss && (
          <button
            onClick={() => {
              setIsVisible(false);
              onDismiss();
            }}
            className={cn(
              'flex-shrink-0 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5',
              config.textColor
            )}
          >
            <AlertCircle className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};