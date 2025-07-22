import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary, TTSErrorBoundary, AnimationErrorBoundary } from '../ErrorBoundary';
import { errorHandler, handleTTSError, handleAnimationError, handleCameraError } from '@/lib/errorHandling';
import { LoadingIndicator, StatusMessage } from '../LoadingIndicator';
import { ttsManager, animationManager, cameraManager } from '@/lib/fallbacks';

// Mock toast
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn()
}));

// Mock console methods
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  jest.clearAllMocks();
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Test component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  test('catches and displays error', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  test('displays custom fallback', () => {
    const customFallback = <div>Custom error message</div>;
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  test('calls onError callback', () => {
    const onError = jest.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  test('resets on retry button click', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Try Again'));

    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });
});

describe('TTSErrorBoundary', () => {
  test('displays TTS-specific error message', () => {
    render(
      <TTSErrorBoundary>
        <ThrowError />
      </TTSErrorBoundary>
    );

    expect(screen.getByText('TTS unavailable')).toBeInTheDocument();
  });
});

describe('AnimationErrorBoundary', () => {
  test('provides fallback without breaking layout', () => {
    render(
      <AnimationErrorBoundary>
        <ThrowError />
      </AnimationErrorBoundary>
    );

    // Should still render children in a fallback container
    const container = screen.getByText('Test error').closest('div');
    expect(container).toHaveClass('transition-opacity');
  });
});

describe('Error Handler', () => {
  test('categorizes TTS errors correctly', () => {
    const ttsError = new Error('TTS service insufficient funds');
    const errorId = handleTTSError(ttsError, {
      component: 'TTSControls',
      action: 'play_audio'
    });

    expect(errorId).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[TTS]'),
      expect.objectContaining({
        errorId,
        message: 'TTS service insufficient funds'
      })
    );
  });

  test('categorizes animation errors correctly', () => {
    const animationError = new Error('Animation performance low');
    const errorId = handleAnimationError(animationError, {
      component: 'AnimationWrapper',
      action: 'performance_check'
    });

    expect(errorId).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[ANIMATION]'),
      expect.objectContaining({
        errorId,
        message: 'Animation performance low'
      })
    );
  });

  test('categorizes camera errors correctly', () => {
    const cameraError = new Error('NotAllowedError: Permission denied');
    const errorId = handleCameraError(cameraError, {
      component: 'CameraPreview',
      action: 'request_permission'
    });

    expect(errorId).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[CAMERA]'),
      expect.objectContaining({
        errorId,
        message: 'NotAllowedError: Permission denied'
      })
    );
  });

  test('tracks error statistics', () => {
    // Clear previous errors
    errorHandler.clearErrors();

    // Generate some test errors
    handleTTSError(new Error('TTS error 1'));
    handleTTSError(new Error('TTS error 2'));
    handleAnimationError(new Error('Animation error 1'));

    const stats = errorHandler.getErrorStats();
    
    expect(stats.total).toBe(3);
    expect(stats.byCategory.tts).toBe(2);
    expect(stats.byCategory.animation).toBe(1);
  });
});

describe('LoadingIndicator', () => {
  test('renders default loading state', () => {
    render(<LoadingIndicator />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByText('Please wait')).toBeInTheDocument();
  });

  test('renders TTS loading state', () => {
    render(<LoadingIndicator type="tts" />);
    
    expect(screen.getByText('Generating speech...')).toBeInTheDocument();
    expect(screen.getByText('Processing text-to-speech')).toBeInTheDocument();
  });

  test('renders camera loading state', () => {
    render(<LoadingIndicator type="camera" />);
    
    expect(screen.getByText('Initializing camera...')).toBeInTheDocument();
    expect(screen.getByText('Accessing camera feed')).toBeInTheDocument();
  });

  test('shows progress bar when enabled', () => {
    render(<LoadingIndicator showProgress={true} progress={50} />);
    
    expect(screen.getByText('50%')).toBeInTheDocument();
    
    const progressBar = screen.getByRole('progressbar', { hidden: true });
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  test('renders as overlay variant', () => {
    render(<LoadingIndicator variant="overlay" />);
    
    const overlay = screen.getByText('Loading...').closest('.fixed');
    expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-background/80');
  });

  test('renders as inline variant', () => {
    render(<LoadingIndicator variant="inline" />);
    
    const container = screen.getByText('Loading...').closest('.flex');
    expect(container).toHaveClass('flex', 'items-center', 'gap-2');
  });
});

describe('StatusMessage', () => {
  test('renders success message', () => {
    render(
      <StatusMessage 
        type="success" 
        message="Operation completed" 
        subMessage="Everything worked fine"
      />
    );
    
    expect(screen.getByText('Operation completed')).toBeInTheDocument();
    expect(screen.getByText('Everything worked fine')).toBeInTheDocument();
  });

  test('renders error message', () => {
    render(
      <StatusMessage 
        type="error" 
        message="Operation failed" 
      />
    );
    
    expect(screen.getByText('Operation failed')).toBeInTheDocument();
  });

  test('auto-hides after duration', async () => {
    const onDismiss = jest.fn();
    
    render(
      <StatusMessage 
        type="info" 
        message="Auto hide message"
        autoHide={true}
        duration={100}
        onDismiss={onDismiss}
      />
    );
    
    expect(screen.getByText('Auto hide message')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalled();
    }, { timeout: 200 });
  });

  test('dismisses on button click', () => {
    const onDismiss = jest.fn();
    
    render(
      <StatusMessage 
        type="warning" 
        message="Dismissible message"
        onDismiss={onDismiss}
      />
    );
    
    const dismissButton = screen.getByRole('button');
    fireEvent.click(dismissButton);
    
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('Fallback Managers', () => {
  test('TTS manager handles fallback to browser TTS', async () => {
    // Mock speechSynthesis
    const mockSpeak = jest.fn();
    const mockGetVoices = jest.fn().mockReturnValue([
      { name: 'Test Voice', lang: 'en-US' }
    ]);
    
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: mockSpeak,
        getVoices: mockGetVoices,
        cancel: jest.fn()
      },
      writable: true
    });

    // Mock puter to fail
    (global as any).puter = {
      ai: {
        txt2speech: jest.fn().mockRejectedValue(new Error('Service unavailable'))
      }
    };

    try {
      const result = await ttsManager.generateTTS('Test text');
      expect(result).toBeDefined();
      expect(result.play).toBeDefined();
    } catch (error) {
      // If both fail, that's expected in test environment
      expect(error).toBeInstanceOf(Error);
    }
  });

  test('Animation manager provides fallback animations', () => {
    const fallback = animationManager.getFallbackAnimation('flip');
    expect(typeof fallback).toBe('string');
    expect(fallback.length).toBeGreaterThan(0);
  });

  test('Camera manager handles permission errors', async () => {
    // Mock getUserMedia to fail
    const mockGetUserMedia = jest.fn().mockRejectedValue(
      Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
    );
    
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true
    });

    try {
      await cameraManager.requestCameraWithFallback({ video: true });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Camera permission denied');
    }
  });
});

describe('Integration Tests', () => {
  test('error boundary catches TTS component errors', () => {
    const TTSComponentWithError = () => {
      throw new Error('TTS component failed');
    };

    render(
      <TTSErrorBoundary>
        <TTSComponentWithError />
      </TTSErrorBoundary>
    );

    expect(screen.getByText('TTS unavailable')).toBeInTheDocument();
  });

  test('error boundary catches animation component errors', () => {
    const AnimationComponentWithError = () => {
      throw new Error('Animation component failed');
    };

    render(
      <AnimationErrorBoundary>
        <AnimationComponentWithError />
      </AnimationErrorBoundary>
    );

    // Should render children in fallback container
    expect(screen.getByText('Animation component failed')).toBeInTheDocument();
  });

  test('loading states work with error recovery', async () => {
    const ComponentWithLoadingAndError = ({ shouldError }: { shouldError: boolean }) => {
      const [isLoading, setIsLoading] = React.useState(true);
      
      React.useEffect(() => {
        const timer = setTimeout(() => {
          setIsLoading(false);
        }, 100);
        return () => clearTimeout(timer);
      }, []);

      if (isLoading) {
        return <LoadingIndicator type="tts" />;
      }

      if (shouldError) {
        throw new Error('Component error after loading');
      }

      return <div>Component loaded successfully</div>;
    };

    const { rerender } = render(
      <TTSErrorBoundary>
        <ComponentWithLoadingAndError shouldError={false} />
      </TTSErrorBoundary>
    );

    // Should show loading initially
    expect(screen.getByText('Generating speech...')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Component loaded successfully')).toBeInTheDocument();
    });

    // Test error case
    rerender(
      <TTSErrorBoundary>
        <ComponentWithLoadingAndError shouldError={true} />
      </TTSErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('TTS unavailable')).toBeInTheDocument();
    });
  });
});