import { toast } from '@/hooks/use-toast';
import { errorHandler } from './errorHandling';

// Feature detection utilities
export const featureDetection = {
  // Check if TTS is supported
  isTTSSupported: (): boolean => {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },

  // Check if camera is supported
  isCameraSupported: (): boolean => {
    return typeof navigator !== 'undefined' && 
           'mediaDevices' in navigator && 
           'getUserMedia' in navigator.mediaDevices;
  },

  // Check if animations should be enabled
  shouldEnableAnimations: (): boolean => {
    if (typeof window === 'undefined') return false;
    
    // Check user preference for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return false;
    
    // Check device performance indicators
    const hardwareConcurrency = navigator.hardwareConcurrency || 1;
    const deviceMemory = (navigator as any).deviceMemory || 1;
    
    // Disable animations on low-end devices
    if (hardwareConcurrency < 2 || deviceMemory < 2) return false;
    
    return true;
  },

  // Check if secure context is available (required for camera)
  isSecureContext: (): boolean => {
    return typeof window !== 'undefined' && 
           (window.isSecureContext || 
            location.protocol === 'https:' || 
            location.hostname === 'localhost' || 
            location.hostname === '127.0.0.1');
  },

  // Check if local storage is available
  isLocalStorageSupported: (): boolean => {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
};

// TTS Fallback System
export class TTSFallbackManager {
  private static instance: TTSFallbackManager;
  private fallbackQueue: Array<{ text: string; resolve: Function; reject: Function }> = [];
  private isProcessing = false;

  static getInstance(): TTSFallbackManager {
    if (!TTSFallbackManager.instance) {
      TTSFallbackManager.instance = new TTSFallbackManager();
    }
    return TTSFallbackManager.instance;
  }

  // Primary TTS with Puter.ai
  async tryPuterTTS(text: string, config?: any): Promise<any> {
    try {
      // Check if puter is available
      if (typeof window === 'undefined' || !(window as any).puter) {
        throw new Error('Puter.ai not available');
      }

      const puter = (window as any).puter;
      const response = await puter.ai.txt2speech(text, config);
      
      // Check if response indicates success
      if (response && typeof response === 'object') {
        if ('success' in response && !response.success) {
          throw new Error(response.error?.message || 'TTS service error');
        }
        if (response.play && typeof response.play === 'function') {
          return response;
        }
      }
      
      return response;
    } catch (error) {
      console.warn('Puter TTS failed:', error);
      throw error;
    }
  }

  // Browser Speech Synthesis fallback
  async tryBrowserTTS(text: string, config?: any): Promise<any> {
    if (!featureDetection.isTTSSupported()) {
      throw new Error('Browser TTS not supported');
    }

    return new Promise((resolve, reject) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Configure voice if possible
        if (config?.voice) {
          const voices = speechSynthesis.getVoices();
          const matchingVoice = voices.find(voice => 
            voice.name.toLowerCase().includes(config.voice.toLowerCase()) ||
            voice.lang.startsWith(config.language?.split('-')[0] || 'en')
          );
          if (matchingVoice) {
            utterance.voice = matchingVoice;
          }
        }

        // Set speech parameters
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Create audio-like interface
        let isPlaying = false;
        let startTime = 0;
        const estimatedDuration = Math.max(text.length * 0.08, 1);

        const fakeAudio = {
          play: () => {
            return new Promise<void>((playResolve, playReject) => {
              if (isPlaying) {
                playResolve();
                return;
              }

              isPlaying = true;
              startTime = Date.now();

              utterance.onstart = () => {
                console.log('Browser TTS started');
              };

              utterance.onend = () => {
                isPlaying = false;
                playResolve();
              };

              utterance.onerror = (event) => {
                isPlaying = false;
                playReject(new Error('Browser TTS error'));
              };

              speechSynthesis.speak(utterance);
            });
          },
          pause: () => {
            if (isPlaying) {
              speechSynthesis.cancel();
              isPlaying = false;
            }
          },
          get currentTime() {
            if (isPlaying && startTime > 0) {
              return Math.min((Date.now() - startTime) / 1000, estimatedDuration);
            }
            return 0;
          },
          set currentTime(value: number) {
            // Seeking not supported
          },
          get duration() {
            return estimatedDuration;
          },
          get paused() {
            return !isPlaying;
          },
          addEventListener: (event: string, handler: any) => {
            if (event === 'loadedmetadata') {
              setTimeout(handler, 0);
            }
          },
          removeEventListener: () => {}
        };

        resolve(fakeAudio);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Main TTS method with fallbacks
  async generateTTS(text: string, config?: any): Promise<any> {
    const errors: Error[] = [];

    // Try Puter.ai first
    try {
      const result = await this.tryPuterTTS(text, config);
      return result;
    } catch (error) {
      errors.push(error as Error);
      console.warn('Primary TTS failed, trying fallback:', error);
    }

    // Try browser TTS as fallback
    try {
      const result = await this.tryBrowserTTS(text, config);
      
      // Show user notification about fallback
      toast({
        title: "Using Browser TTS",
        description: "Primary TTS service unavailable. Using browser speech synthesis.",
        duration: 3000
      });
      
      return result;
    } catch (error) {
      errors.push(error as Error);
      console.error('All TTS methods failed:', errors);
    }

    // If all methods fail, throw comprehensive error
    const combinedError = new Error(
      `All TTS methods failed: ${errors.map(e => e.message).join(', ')}`
    );
    
    errorHandler.handleError(combinedError, {
      component: 'TTSFallbackManager',
      action: 'generate_tts',
      additionalData: { originalConfig: config, errorCount: errors.length }
    });

    throw combinedError;
  }
}

// Animation Fallback System
export class AnimationFallbackManager {
  private static shouldUseAnimations: boolean | null = null;

  static shouldEnableAnimations(): boolean {
    if (this.shouldUseAnimations === null) {
      this.shouldUseAnimations = featureDetection.shouldEnableAnimations();
    }
    return this.shouldUseAnimations;
  }

  static getFallbackAnimation(requestedAnimation: string): string {
    if (!this.shouldEnableAnimations()) {
      return 'transition-opacity duration-200';
    }

    // Provide simpler animations for low-performance devices
    const hardwareConcurrency = navigator.hardwareConcurrency || 1;
    if (hardwareConcurrency < 4) {
      switch (requestedAnimation) {
        case 'flip':
        case 'rotate':
          return 'transition-transform duration-300';
        case 'slide':
          return 'transition-transform duration-200';
        case 'fade':
          return 'transition-opacity duration-200';
        default:
          return 'transition-opacity duration-200';
      }
    }

    return requestedAnimation;
  }

  static handleAnimationError(error: Error, animationType: string): void {
    console.warn(`Animation error for ${animationType}:`, error);
    
    // Disable animations temporarily
    this.shouldUseAnimations = false;
    
    toast({
      title: "Animation Disabled",
      description: "Animation performance issues detected. Animations have been simplified.",
      duration: 3000
    });

    errorHandler.handleError(error, {
      component: 'AnimationFallbackManager',
      action: 'animation_error',
      additionalData: { animationType }
    });
  }
}

// Camera Fallback System
export class CameraFallbackManager {
  static async requestCameraWithFallback(constraints: MediaStreamConstraints): Promise<MediaStream> {
    if (!featureDetection.isCameraSupported()) {
      throw new Error('Camera not supported in this browser');
    }

    if (!featureDetection.isSecureContext()) {
      throw new Error('Camera requires HTTPS or localhost');
    }

    const errors: Error[] = [];

    // Try with original constraints
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      errors.push(error as Error);
      console.warn('Camera request failed with original constraints:', error);
    }

    // Try with simplified constraints
    try {
      const simplifiedConstraints = {
        video: true,
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(simplifiedConstraints);
      
      toast({
        title: "Camera Fallback",
        description: "Using simplified camera settings due to compatibility issues.",
        duration: 3000
      });
      
      return stream;
    } catch (error) {
      errors.push(error as Error);
      console.error('All camera methods failed:', errors);
    }

    // Provide specific error messages
    const lastError = errors[errors.length - 1];
    let userMessage = 'Camera access failed';
    
    if (lastError.name === 'NotAllowedError') {
      userMessage = 'Camera permission denied. Please allow camera access.';
    } else if (lastError.name === 'NotFoundError') {
      userMessage = 'No camera found. Please connect a camera.';
    } else if (lastError.name === 'NotReadableError') {
      userMessage = 'Camera is being used by another application.';
    }

    const combinedError = new Error(userMessage);
    errorHandler.handleError(combinedError, {
      component: 'CameraFallbackManager',
      action: 'request_camera',
      additionalData: { errorCount: errors.length }
    });

    throw combinedError;
  }
}

// Configuration Fallback System
export class ConfigurationFallbackManager {
  private static defaultConfig: any = null;

  static setDefaultConfig(config: any): void {
    this.defaultConfig = { ...config };
  }

  static loadConfigWithFallback<T>(key: string, defaultValue: T): T {
    if (!featureDetection.isLocalStorageSupported()) {
      console.warn('LocalStorage not supported, using default configuration');
      return defaultValue;
    }

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaultValue, ...parsed };
      }
    } catch (error) {
      console.warn(`Failed to load configuration for ${key}:`, error);
      
      errorHandler.handleError(error as Error, {
        component: 'ConfigurationFallbackManager',
        action: 'load_config',
        additionalData: { key }
      });
    }

    return defaultValue;
  }

  static saveConfigWithFallback<T>(key: string, config: T): boolean {
    if (!featureDetection.isLocalStorageSupported()) {
      console.warn('LocalStorage not supported, configuration not saved');
      return false;
    }

    try {
      localStorage.setItem(key, JSON.stringify(config));
      return true;
    } catch (error) {
      console.error(`Failed to save configuration for ${key}:`, error);
      
      errorHandler.handleError(error as Error, {
        component: 'ConfigurationFallbackManager',
        action: 'save_config',
        additionalData: { key }
      });
      
      toast({
        title: "Settings Save Failed",
        description: "Unable to save settings. They will be reset when you refresh the page.",
        variant: "destructive",
        duration: 5000
      });
      
      return false;
    }
  }
}

// Export singleton instances
export const ttsManager = TTSFallbackManager.getInstance();
export const animationManager = AnimationFallbackManager;
export const cameraManager = CameraFallbackManager;
export const configManager = ConfigurationFallbackManager;