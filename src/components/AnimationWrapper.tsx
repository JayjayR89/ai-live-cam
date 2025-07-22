import React, { useEffect, useState, memo } from 'react';
import { AnimationErrorBoundary } from './ErrorBoundary';
import { handleAnimationError } from '@/lib/errorHandling';
import { animationManager } from '@/lib/fallbacks';

export type AnimationType = 'flip' | 'fade' | 'slide' | 'none';

interface AnimationWrapperProps {
  children: React.ReactNode;
  isAnimating: boolean;
  animationType?: AnimationType;
  duration?: number;
  className?: string;
  onAnimationComplete?: () => void;
}

const AnimationWrapperInner: React.FC<AnimationWrapperProps> = memo(({
  children,
  isAnimating,
  animationType = 'flip',
  duration = 800,
  className = '',
  onAnimationComplete
}) => {
  const [animationClass, setAnimationClass] = useState('');
  const [shouldRespectMotionPreference, setShouldRespectMotionPreference] = useState(false);
  const [isLowPerformanceDevice, setIsLowPerformanceDevice] = useState(false);
  const [hasAnimationError, setHasAnimationError] = useState(false);

  // Check user motion preferences and device performance
  useEffect(() => {
    try {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setShouldRespectMotionPreference(mediaQuery.matches);
      setIsLowPerformanceDevice(detectLowPerformanceDevice());

      const handleChange = (e: MediaQueryListEvent) => {
        setShouldRespectMotionPreference(e.matches);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } catch (error) {
      handleAnimationError(error as Error, {
        component: 'AnimationWrapper',
        action: 'setup_preferences'
      });
      // Fallback to safe defaults
      setShouldRespectMotionPreference(true);
      setIsLowPerformanceDevice(true);
    }
  }, []);

  // Handle animation state changes with error handling
  useEffect(() => {
    try {
      if (!isAnimating || hasAnimationError) {
        setAnimationClass('');
        return;
      }

      // Use fallback manager to get appropriate animation
      const fallbackAnimation = animationManager.getFallbackAnimation(
        shouldRespectMotionPreference || isLowPerformanceDevice ? 'fade' : animationType
      );

      // If user prefers reduced motion or device is low-performance, use simple fade
      if (shouldRespectMotionPreference || isLowPerformanceDevice) {
        setAnimationClass('transition-opacity duration-200 ease-in-out');
      } else {
        // Apply the appropriate animation class with fallback
        const animationClasses = {
          flip: 'animate-camera-flip',
          fade: 'animate-camera-fade',
          slide: 'animate-camera-slide',
          none: ''
        };
        
        setAnimationClass(animationClasses[animationType] || fallbackAnimation);
      }

      // Set up animation completion callback with error handling
      if (onAnimationComplete) {
        const timeout = setTimeout(() => {
          try {
            onAnimationComplete();
          } catch (error) {
            handleAnimationError(error as Error, {
              component: 'AnimationWrapper',
              action: 'animation_complete_callback'
            });
          }
        }, (shouldRespectMotionPreference || isLowPerformanceDevice) ? 200 : duration);

        return () => clearTimeout(timeout);
      }
    } catch (error) {
      handleAnimationError(error as Error, {
        component: 'AnimationWrapper',
        action: 'setup_animation',
        additionalData: { animationType, duration }
      });
      
      // Set error state and use fallback
      setHasAnimationError(true);
      setAnimationClass('transition-opacity duration-200 ease-in-out');
    }
  }, [isAnimating, animationType, duration, shouldRespectMotionPreference, isLowPerformanceDevice, onAnimationComplete, hasAnimationError]);

  // Monitor animation performance with debouncing
  useEffect(() => {
    if (!isAnimating || hasAnimationError) return;

    let frameCount = 0;
    let startTime = performance.now();
    let animationId: number;
    let performanceWarningShown = false;
    let lastFrameTime = startTime;

    const measureFrameRate = () => {
      try {
        const currentTime = performance.now();
        const deltaTime = currentTime - lastFrameTime;
        
        // Debounce frame rate measurements to reduce overhead
        if (deltaTime >= 16.67) { // ~60fps threshold
          frameCount++;
          lastFrameTime = currentTime;
        }

        const elapsed = currentTime - startTime;

        if (elapsed >= 1000) {
          const fps = Math.round((frameCount * 1000) / elapsed);
          
          // Log performance warning if FPS is too low
          if (fps < 20 && !performanceWarningShown) {
            performanceWarningShown = true;
            const error = new Error(`Low animation performance: ${fps} FPS`);
            handleAnimationError(error, {
              component: 'AnimationWrapper',
              action: 'performance_monitoring',
              additionalData: { fps, animationType }
            });
            
            // Disable animations for this session
            setHasAnimationError(true);
            setAnimationClass('transition-opacity duration-200 ease-in-out');
            return;
          }

          frameCount = 0;
          startTime = currentTime;
        }

        // Use requestAnimationFrame for smooth monitoring
        animationId = requestAnimationFrame(measureFrameRate);
      } catch (error) {
        handleAnimationError(error as Error, {
          component: 'AnimationWrapper',
          action: 'performance_measurement'
        });
      }
    };

    // Only monitor during animations and in development or low-performance devices
    if (process.env.NODE_ENV === 'development' || isLowPerformanceDevice) {
      animationId = requestAnimationFrame(measureFrameRate);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isAnimating, animationType, isLowPerformanceDevice, hasAnimationError]);

  return (
    <div 
      className={`${animationClass} ${className}`}
      style={{
        // Hardware acceleration for better performance
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        perspective: '1000px'
      }}
      onAnimationEnd={() => {
        try {
          // Reset error state on successful animation completion
          if (hasAnimationError) {
            setHasAnimationError(false);
          }
        } catch (error) {
          handleAnimationError(error as Error, {
            component: 'AnimationWrapper',
            action: 'animation_end_handler'
          });
        }
      }}
      onTransitionEnd={() => {
        try {
          // Handle transition end for fallback animations
          if (hasAnimationError) {
            setHasAnimationError(false);
          }
        } catch (error) {
          handleAnimationError(error as Error, {
            component: 'AnimationWrapper',
            action: 'transition_end_handler'
          });
        }
      }}
    >
      {children}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo optimization
  return (
    prevProps.isAnimating === nextProps.isAnimating &&
    prevProps.animationType === nextProps.animationType &&
    prevProps.duration === nextProps.duration &&
    prevProps.className === nextProps.className &&
    prevProps.onAnimationComplete === nextProps.onAnimationComplete &&
    prevProps.children === nextProps.children
  );
});

// Add display name for debugging
AnimationWrapperInner.displayName = 'AnimationWrapperInner';

// Wrap with error boundary
export const AnimationWrapper: React.FC<AnimationWrapperProps> = (props) => (
  <AnimationErrorBoundary>
    <AnimationWrapperInner {...props} />
  </AnimationErrorBoundary>
);

// Hook for managing animation states
export const useAnimation = (initialType: AnimationType = 'flip') => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationType, setAnimationType] = useState<AnimationType>(initialType);

  const startAnimation = (type?: AnimationType) => {
    if (type) setAnimationType(type);
    setIsAnimating(true);
  };

  const stopAnimation = () => {
    setIsAnimating(false);
  };

  return {
    isAnimating,
    animationType,
    startAnimation,
    stopAnimation,
    setAnimationType
  };
};

// Utility function to detect if animations should be disabled
export const shouldDisableAnimations = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
};

// Performance detection utility
export const detectLowPerformanceDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check for low-end device indicators
  const hardwareConcurrency = navigator.hardwareConcurrency || 1;
  const deviceMemory = (navigator as any).deviceMemory || 1;
  const connection = (navigator as any).connection;
  
  // Consider device low-performance if:
  // - Less than 2 CPU cores
  // - Less than 2GB RAM
  // - Slow network connection
  const isLowEndCPU = hardwareConcurrency < 2;
  const isLowEndRAM = deviceMemory < 2;
  const isSlowConnection = connection && (
    connection.effectiveType === 'slow-2g' || 
    connection.effectiveType === '2g' ||
    connection.saveData === true
  );
  
  return isLowEndCPU || isLowEndRAM || isSlowConnection;
};

// Performance monitoring utility
export const withPerformanceMonitoring = <T extends Record<string, any>>(
  Component: React.ComponentType<T>
) => {
  return React.forwardRef<any, T>((props, ref) => {
    useEffect(() => {
      // Monitor frame rate during animations
      let frameCount = 0;
      let startTime = performance.now();
      let animationId: number;

      const measureFrameRate = () => {
        frameCount++;
        const currentTime = performance.now();
        const elapsed = currentTime - startTime;

        if (elapsed >= 1000) {
          const fps = Math.round((frameCount * 1000) / elapsed);
          
          // Log performance warning if FPS is too low
          if (fps < 30) {
            console.warn(`Animation performance warning: ${fps} FPS detected`);
          }

          frameCount = 0;
          startTime = currentTime;
        }

        animationId = requestAnimationFrame(measureFrameRate);
      };

      // Only monitor during development
      if (process.env.NODE_ENV === 'development') {
        animationId = requestAnimationFrame(measureFrameRate);
      }

      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
      };
    }, []);

    return <Component {...props} ref={ref} />;
  });
};