import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBoundary, TTSErrorBoundary, AnimationErrorBoundary } from './ErrorBoundary';
import { LoadingIndicator, StatusMessage, useLoadingOverlay } from './LoadingIndicator';
import { errorHandler, handleTTSError, handleAnimationError, handleCameraError } from '@/lib/errorHandling';
import { ttsManager } from '@/lib/fallbacks';

// Component that throws different types of errors for testing
const ErrorThrower: React.FC<{ errorType: string }> = ({ errorType }) => {
  switch (errorType) {
    case 'tts':
      throw new Error('TTS service insufficient funds');
    case 'animation':
      throw new Error('Animation performance too low');
    case 'camera':
      throw new Error('NotAllowedError: Camera permission denied');
    case 'generic':
      throw new Error('Generic application error');
    default:
      return <div>No error - component working normally</div>;
  }
};

export const ErrorHandlingDemo: React.FC = () => {
  const [errorType, setErrorType] = useState<string>('none');
  const [showStatus, setShowStatus] = useState<string>('');
  const { isLoading, showLoading, hideLoading, LoadingOverlay } = useLoadingOverlay();

  // Demonstrate programmatic error handling
  const handleProgrammaticError = (type: string) => {
    const error = new Error(`Programmatic ${type} error for testing`);
    
    switch (type) {
      case 'tts':
        handleTTSError(error, {
          component: 'ErrorHandlingDemo',
          action: 'test_tts_error'
        });
        break;
      case 'animation':
        handleAnimationError(error, {
          component: 'ErrorHandlingDemo',
          action: 'test_animation_error'
        });
        break;
      case 'camera':
        handleCameraError(error, {
          component: 'ErrorHandlingDemo',
          action: 'test_camera_error'
        });
        break;
    }
  };

  // Demonstrate TTS fallback
  const testTTSFallback = async () => {
    showLoading({
      type: 'tts',
      message: 'Testing TTS fallback...',
      subMessage: 'This will demonstrate fallback mechanisms'
    });

    try {
      // This will likely fail and trigger fallback to browser TTS
      await ttsManager.generateTTS('This is a test of the TTS fallback system');
      setShowStatus('success');
    } catch (error) {
      setShowStatus('error');
    } finally {
      hideLoading();
    }
  };

  // Demonstrate loading states
  const testLoadingStates = () => {
    showLoading({
      type: 'camera',
      message: 'Simulating camera initialization...',
      showProgress: true,
      progress: 0
    });

    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      showLoading({
        type: 'camera',
        message: 'Simulating camera initialization...',
        showProgress: true,
        progress
      });

      if (progress >= 100) {
        clearInterval(interval);
        hideLoading();
        setShowStatus('success');
      }
    }, 500);
  };

  // Get error statistics
  const errorStats = errorHandler.getErrorStats();

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Error Handling & User Feedback Demo</h1>
      
      {/* Error Boundary Tests */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Error Boundary Tests</h2>
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setErrorType('none')} variant="outline">
              No Error
            </Button>
            <Button onClick={() => setErrorType('tts')} variant="destructive">
              TTS Error
            </Button>
            <Button onClick={() => setErrorType('animation')} variant="destructive">
              Animation Error
            </Button>
            <Button onClick={() => setErrorType('camera')} variant="destructive">
              Camera Error
            </Button>
            <Button onClick={() => setErrorType('generic')} variant="destructive">
              Generic Error
            </Button>
          </div>

          {/* TTS Error Boundary */}
          <div className="border rounded p-3">
            <h3 className="font-medium mb-2">TTS Error Boundary:</h3>
            <TTSErrorBoundary>
              <ErrorThrower errorType={errorType === 'tts' ? 'tts' : 'none'} />
            </TTSErrorBoundary>
          </div>

          {/* Animation Error Boundary */}
          <div className="border rounded p-3">
            <h3 className="font-medium mb-2">Animation Error Boundary:</h3>
            <AnimationErrorBoundary>
              <ErrorThrower errorType={errorType === 'animation' ? 'animation' : 'none'} />
            </AnimationErrorBoundary>
          </div>

          {/* Generic Error Boundary */}
          <div className="border rounded p-3">
            <h3 className="font-medium mb-2">Generic Error Boundary:</h3>
            <ErrorBoundary>
              <ErrorThrower errorType={errorType === 'generic' ? 'generic' : 'none'} />
            </ErrorBoundary>
          </div>
        </div>
      </Card>

      {/* Programmatic Error Handling */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Programmatic Error Handling</h2>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => handleProgrammaticError('tts')} variant="outline">
            Trigger TTS Error
          </Button>
          <Button onClick={() => handleProgrammaticError('animation')} variant="outline">
            Trigger Animation Error
          </Button>
          <Button onClick={() => handleProgrammaticError('camera')} variant="outline">
            Trigger Camera Error
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          These will show toast notifications and log errors to console
        </p>
      </Card>

      {/* Loading Indicators */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Loading Indicators</h2>
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={testLoadingStates} variant="outline">
              Test Loading with Progress
            </Button>
            <Button onClick={testTTSFallback} variant="outline">
              Test TTS Fallback
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium">Different Loading Types:</h3>
              <LoadingIndicator type="tts" size="sm" />
              <LoadingIndicator type="camera" size="sm" />
              <LoadingIndicator type="animation" size="sm" />
              <LoadingIndicator type="settings" size="sm" />
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Different Variants:</h3>
              <LoadingIndicator variant="inline" message="Inline loading" />
              <LoadingIndicator variant="card" message="Card loading" size="sm" />
            </div>
          </div>
        </div>
      </Card>

      {/* Status Messages */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Status Messages</h2>
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setShowStatus('success')} variant="outline">
              Show Success
            </Button>
            <Button onClick={() => setShowStatus('warning')} variant="outline">
              Show Warning
            </Button>
            <Button onClick={() => setShowStatus('error')} variant="outline">
              Show Error
            </Button>
            <Button onClick={() => setShowStatus('info')} variant="outline">
              Show Info
            </Button>
            <Button onClick={() => setShowStatus('')} variant="outline">
              Clear
            </Button>
          </div>

          {showStatus === 'success' && (
            <StatusMessage
              type="success"
              message="Operation completed successfully"
              subMessage="All systems are working normally"
              onDismiss={() => setShowStatus('')}
            />
          )}

          {showStatus === 'warning' && (
            <StatusMessage
              type="warning"
              message="Performance warning detected"
              subMessage="Some features may be running slower than expected"
              onDismiss={() => setShowStatus('')}
            />
          )}

          {showStatus === 'error' && (
            <StatusMessage
              type="error"
              message="Operation failed"
              subMessage="Please try again or contact support"
              onDismiss={() => setShowStatus('')}
            />
          )}

          {showStatus === 'info' && (
            <StatusMessage
              type="info"
              message="System information"
              subMessage="Using fallback mechanisms for better compatibility"
              onDismiss={() => setShowStatus('')}
            />
          )}
        </div>
      </Card>

      {/* Error Statistics */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Error Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{errorStats.total}</div>
            <div className="text-sm text-muted-foreground">Total Errors</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{errorStats.byCategory.tts || 0}</div>
            <div className="text-sm text-muted-foreground">TTS Errors</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{errorStats.byCategory.animation || 0}</div>
            <div className="text-sm text-muted-foreground">Animation Errors</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{errorStats.byCategory.camera || 0}</div>
            <div className="text-sm text-muted-foreground">Camera Errors</div>
          </div>
        </div>
        
        <div className="mt-4 flex gap-2">
          <Button onClick={() => errorHandler.clearErrors()} variant="outline" size="sm">
            Clear Error History
          </Button>
          <Button 
            onClick={() => console.log('Recent errors:', errorHandler.getRecentErrors())} 
            variant="outline" 
            size="sm"
          >
            Log Recent Errors
          </Button>
        </div>
      </Card>

      {/* Loading Overlay */}
      {LoadingOverlay}
    </div>
  );
};