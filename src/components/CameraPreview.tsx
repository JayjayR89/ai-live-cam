
import React, { useState, useCallback, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Minimize2, Maximize2, Loader } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AnimationWrapper, useAnimation, type AnimationType } from './AnimationWrapper';
import { ErrorBoundary } from './ErrorBoundary';
import { handleCameraError } from '@/lib/errorHandling';
import { LoadingIndicator } from './LoadingIndicator';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onFlipCamera: () => void;
  isCameraLoading: boolean;
  videoLoaded: boolean;
  availableCameras: MediaDeviceInfo[];
  showFlipButton?: boolean;
  previewMinWidth?: number;
  previewMinHeight?: number;
  maintainAspectRatio?: boolean;
  isFlipping?: boolean;
}

type DeviceType = 'desktop' | 'mobile';
type AspectRatio = '16:9' | '9:16';

const CameraPreviewInner: React.FC<CameraPreviewProps> = memo(({
  videoRef,
  isMinimized,
  onToggleMinimize,
  onFlipCamera,
  isCameraLoading,
  videoLoaded,
  availableCameras,
  showFlipButton = true,
  previewMinWidth = 400,
  previewMinHeight = 225,
  maintainAspectRatio = true,
  isFlipping = false
}) => {
  const [lastTap, setLastTap] = useState<number>(0);
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  
  // Animation management
  const animation = useAnimation('flip');
  const [animationType, setAnimationType] = useState<AnimationType>('flip');

  // Sync animation state with isFlipping prop
  useEffect(() => {
    if (isFlipping && !animation.isAnimating) {
      // Vary animation type based on device for better UX
      const selectedAnimation: AnimationType = deviceType === 'mobile' ? 'slide' : 'flip';
      setAnimationType(selectedAnimation);
      animation.startAnimation(selectedAnimation);
    } else if (!isFlipping && animation.isAnimating) {
      animation.stopAnimation();
    }
  }, [isFlipping, animation, deviceType]);

  // Device detection and aspect ratio determination
  useEffect(() => {
    const detectDevice = () => {
      // Check for mobile devices using user agent
      const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Check for touch capability
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Check screen size - mobile typically has smaller screens
      const isSmallScreen = window.innerWidth <= 768;
      
      // Check orientation - portrait is more common on mobile
      const isPortrait = window.innerHeight > window.innerWidth;
      
      // Determine device type based on multiple factors
      const isMobile = isMobileUserAgent || (isTouchDevice && isSmallScreen);
      
      const newDeviceType: DeviceType = isMobile ? 'mobile' : 'desktop';
      const newAspectRatio: AspectRatio = (isMobile && isPortrait) ? '9:16' : '16:9';
      
      setDeviceType(newDeviceType);
      setAspectRatio(newAspectRatio);
      
      console.log('Device detection:', {
        deviceType: newDeviceType,
        aspectRatio: newAspectRatio,
        isMobileUserAgent,
        isTouchDevice,
        isSmallScreen,
        isPortrait,
        screenSize: `${window.innerWidth}x${window.innerHeight}`
      });
    };

    // Initial detection
    detectDevice();

    // Re-detect on window resize (orientation change)
    const handleResize = () => {
      detectDevice();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Enhanced camera flip handler with error handling
  const handleFlipCamera = useCallback(() => {
    if (isCameraLoading || isFlipping) return;
    
    try {
      onFlipCamera();
    } catch (error) {
      handleCameraError(error as Error, {
        component: 'CameraPreview',
        action: 'flip_camera',
        additionalData: { deviceType, aspectRatio }
      });
    }
  }, [isCameraLoading, isFlipping, onFlipCamera, deviceType, aspectRatio]);

  // Double-tap handler for mobile camera flip with error handling
  const handleVideoTap = useCallback(() => {
    try {
      const now = Date.now();
      const timeDiff = now - lastTap;
      
      if (timeDiff < 300 && timeDiff > 0) {
        // Double tap detected - flip camera
        handleFlipCamera();
      }
      
      setLastTap(now);
    } catch (error) {
      handleCameraError(error as Error, {
        component: 'CameraPreview',
        action: 'double_tap_handler'
      });
    }
  }, [lastTap, handleFlipCamera]);

  // Check if we should show flip button (more lenient conditions for mobile)
  const shouldShowFlipButton = () => {
    // Always show on mobile devices (they typically have multiple cameras)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Show if:
    // 1. Explicitly enabled AND
    // 2. Camera is not loading AND
    // 3. Either we detected multiple cameras OR we're on mobile (where enumeration might fail)
    return showFlipButton && 
           !isCameraLoading && 
           (availableCameras.length > 1 || isMobile || availableCameras.length === 0);
  };
  const getMinimizedStyle = () => {
    if (!isMinimized) return {};
    
    if (maintainAspectRatio) {
      // Calculate height based on current aspect ratio
      let aspectHeight: number;
      if (aspectRatio === '9:16') {
        // For mobile portrait: width is smaller, height is larger
        aspectHeight = (previewMinWidth * 16) / 9;
      } else {
        // For desktop landscape: 16:9 ratio
        aspectHeight = (previewMinWidth * 9) / 16;
      }
      
      return {
        width: `${previewMinWidth}px`,
        height: `${aspectHeight}px`
      };
    }
    
    return {
      width: `${previewMinWidth}px`,
      height: `${previewMinHeight}px`
    };
  };

  // Get responsive aspect ratio class
  const getAspectRatioClass = () => {
    if (aspectRatio === '9:16') {
      return 'aspect-[9/16]'; // Mobile portrait
    }
    return 'aspect-video'; // Desktop landscape (16:9)
  };

  // Get responsive container classes
  const getContainerClasses = () => {
    const baseClasses = 'bg-muted/20 rounded-lg overflow-hidden camera-preview relative';
    const aspectClass = getAspectRatioClass();
    const minimizedClass = isMinimized ? 'minimized' : '';
    
    if (isMinimized) {
      return `${baseClasses} ${aspectClass} ${minimizedClass} h-full`;
    }
    
    // Full size responsive classes
    return `${baseClasses} ${aspectClass} w-full max-w-full`;
  };

  // Get video classes for proper display without cropping
  const getVideoClasses = () => {
    const baseClasses = 'w-full h-full transition-opacity duration-300 cursor-pointer';
    const opacityClass = videoLoaded ? 'opacity-100' : 'opacity-0';
    
    // Use object-contain to ensure complete video display without cropping
    // This ensures the entire camera feed is visible within the container
    const objectFitClass = 'object-contain';
    
    return `${baseClasses} ${opacityClass} ${objectFitClass}`;
  };

  return (
    <Card 
      className={`relative transition-all duration-300 ${
        isMinimized ? 'mx-auto' : 'w-full'
      }`}
      style={getMinimizedStyle()}
    >
      <div className={getContainerClasses()}>
        {(isCameraLoading || isFlipping) && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-4 p-6 bg-background/80 rounded-lg border shadow-lg">
              <div className="relative">
                <Loader className="h-10 w-10 animate-spin text-primary" />
                {isFlipping && (
                  <div className="absolute inset-0 animate-camera-loading">
                    <RotateCcw className="h-10 w-10 text-primary/50" />
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {isFlipping ? 'Switching camera...' : 'Loading camera...'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isFlipping ? 'Please wait while we switch cameras' : 'Initializing camera feed'}
                </p>
              </div>
              {/* Progress indicator for camera flip */}
              {isFlipping && (
                <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse rounded-full" style={{
                    animation: 'loading-progress 0.8s ease-in-out'
                  }} />
                </div>
              )}
            </div>
          </div>
        )}
        
        <AnimationWrapper
          isAnimating={animation.isAnimating}
          animationType={animationType}
          duration={800}
          className="w-full h-full"
          onAnimationComplete={() => {
            // Animation completed, can perform any cleanup here
            console.log(`Camera ${animationType} animation completed`);
          }}
        >
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={getVideoClasses()}
            style={{ aspectRatio: aspectRatio }}
            onClick={handleVideoTap}
            onTouchEnd={handleVideoTap}
          />
        </AnimationWrapper>
        
        {/* Top Left - Minimize/Maximize Button */}
        <Button 
          variant="secondary" 
          size="icon" 
          onClick={onToggleMinimize} 
          className="absolute top-4 left-4 bg-black/50 hover:bg-black/70 z-20"
          title={isMinimized ? "Expand camera preview" : "Minimize camera preview"}
        >
          {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
        </Button>
        
        {/* Top Right - Flip Camera Button - Show on mobile and when multiple cameras detected */}
        {shouldShowFlipButton() && (
          <Button 
            variant="secondary" 
            size="icon" 
            onClick={handleFlipCamera} 
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 z-20"
            disabled={isCameraLoading || isFlipping}
            title="Switch camera (front/back) - Double tap video to flip"
          >
            {isFlipping ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
          </Button>
        )}
        
        {/* Double-tap hint for mobile users */}
        {shouldShowFlipButton() && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
            <div className="bg-black/60 text-white text-xs px-3 py-1 rounded-full opacity-70">
              Double tap to flip camera
            </div>
          </div>
        )}
        
        {/* Device info display (for debugging - can be removed in production) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-16 left-4 z-10">
            <div className="bg-black/80 text-white text-xs px-2 py-1 rounded opacity-70">
              {deviceType} | {aspectRatio}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo optimization
  return (
    prevProps.isMinimized === nextProps.isMinimized &&
    prevProps.isCameraLoading === nextProps.isCameraLoading &&
    prevProps.videoLoaded === nextProps.videoLoaded &&
    prevProps.isFlipping === nextProps.isFlipping &&
    prevProps.showFlipButton === nextProps.showFlipButton &&
    prevProps.previewMinWidth === nextProps.previewMinWidth &&
    prevProps.previewMinHeight === nextProps.previewMinHeight &&
    prevProps.maintainAspectRatio === nextProps.maintainAspectRatio &&
    prevProps.availableCameras.length === nextProps.availableCameras.length &&
    prevProps.videoRef === nextProps.videoRef &&
    prevProps.onToggleMinimize === nextProps.onToggleMinimize &&
    prevProps.onFlipCamera === nextProps.onFlipCamera
  );
});

// Add display name for debugging
CameraPreviewInner.displayName = 'CameraPreviewInner';

// Wrap with error boundary
export const CameraPreview: React.FC<CameraPreviewProps> = (props) => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      handleCameraError(error, {
        component: 'CameraPreview',
        action: 'component_error',
        additionalData: { 
          props: {
            isMinimized: props.isMinimized,
            isCameraLoading: props.isCameraLoading,
            videoLoaded: props.videoLoaded,
            availableCameras: props.availableCameras.length
          }
        }
      });
    }}
    fallback={
      <Card className="p-6 border-destructive">
        <div className="flex flex-col items-center text-center space-y-4">
          <LoadingIndicator
            type="error"
            message="Camera Preview Error"
            subMessage="Unable to display camera preview. Please refresh the page."
            size="md"
          />
        </div>
      </Card>
    }
  >
    <CameraPreviewInner {...props} />
  </ErrorBoundary>
);
