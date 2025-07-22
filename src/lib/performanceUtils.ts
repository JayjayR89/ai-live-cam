// Performance optimization utilities

/**
 * Debounce function to limit the rate of function calls
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
};

/**
 * Throttle function to limit function calls to once per specified time period
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Request animation frame with fallback for older browsers
 */
export const requestAnimationFramePolyfill = (callback: FrameRequestCallback): number => {
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    return window.requestAnimationFrame(callback);
  }
  // Fallback for older browsers
  return setTimeout(callback, 1000 / 60) as any;
};

/**
 * Cancel animation frame with fallback for older browsers
 */
export const cancelAnimationFramePolyfill = (id: number): void => {
  if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
    window.cancelAnimationFrame(id);
  } else {
    clearTimeout(id);
  }
};

/**
 * Check if device supports hardware acceleration
 */
export const supportsHardwareAcceleration = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check for CSS transform3d support
  const testElement = document.createElement('div');
  testElement.style.transform = 'translate3d(0, 0, 0)';
  
  return testElement.style.transform !== '';
};

/**
 * Detect if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
};

/**
 * Performance monitoring utility
 */
export class PerformanceMonitor {
  private frameCount = 0;
  private startTime = 0;
  private animationId: number | null = null;
  private onLowPerformance?: (fps: number) => void;
  private threshold = 30; // FPS threshold

  constructor(onLowPerformance?: (fps: number) => void, threshold = 30) {
    this.onLowPerformance = onLowPerformance;
    this.threshold = threshold;
  }

  start(): void {
    this.frameCount = 0;
    this.startTime = performance.now();
    this.measureFrameRate();
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFramePolyfill(this.animationId);
      this.animationId = null;
    }
  }

  private measureFrameRate = (): void => {
    this.frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - this.startTime;

    if (elapsed >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / elapsed);
      
      if (fps < this.threshold && this.onLowPerformance) {
        this.onLowPerformance(fps);
      }

      this.frameCount = 0;
      this.startTime = currentTime;
    }

    this.animationId = requestAnimationFramePolyfill(this.measureFrameRate);
  };
}

/**
 * Memory cleanup utility for components
 */
export const createCleanupManager = () => {
  const cleanupTasks: (() => void)[] = [];

  const addCleanupTask = (task: () => void) => {
    cleanupTasks.push(task);
  };

  const cleanup = () => {
    cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        console.warn('Cleanup task failed:', error);
      }
    });
    cleanupTasks.length = 0;
  };

  return { addCleanupTask, cleanup };
};

/**
 * Optimize component re-renders by comparing props
 */
export const shallowEqual = (obj1: any, obj2: any): boolean => {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (let key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return false;
    }
  }

  return true;
};

/**
 * Deep comparison for complex objects (use sparingly)
 */
export const deepEqual = (obj1: any, obj2: any): boolean => {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return false;
  
  if (typeof obj1 !== typeof obj2) return false;
  
  if (typeof obj1 !== 'object') return obj1 === obj2;
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (let key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
};

/**
 * Batch DOM updates for better performance
 */
export const batchDOMUpdates = (updates: (() => void)[]): void => {
  requestAnimationFramePolyfill(() => {
    updates.forEach(update => {
      try {
        update();
      } catch (error) {
        console.warn('DOM update failed:', error);
      }
    });
  });
};

/**
 * Lazy load images with intersection observer
 */
export const createLazyImageLoader = (
  threshold = 0.1,
  rootMargin = '50px'
) => {
  if (typeof window === 'undefined' || !window.IntersectionObserver) {
    return null;
  }

  return new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
          }
        }
      });
    },
    { threshold, rootMargin }
  );
};

/**
 * Optimize scroll event handling
 */
export const createOptimizedScrollHandler = (
  handler: (event: Event) => void,
  options: { throttle?: number; passive?: boolean } = {}
) => {
  const { throttle: throttleMs = 16, passive = true } = options;
  
  const throttledHandler = throttle(handler, throttleMs);
  
  return {
    addEventListener: (element: Element | Window = window) => {
      element.addEventListener('scroll', throttledHandler, { passive });
    },
    removeEventListener: (element: Element | Window = window) => {
      element.removeEventListener('scroll', throttledHandler);
    }
  };
};