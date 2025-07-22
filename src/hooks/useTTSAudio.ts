import { useState, useRef, useCallback, useEffect } from 'react';

// Using Puter.com API loaded from CDN
declare const puter: any;

export interface TTSVoice {
  language: string;
  name: string;
  engine: 'standard' | 'neural' | 'generative';
  displayName: string;
}

export interface TTSConfig {
  engine: 'standard' | 'neural' | 'generative';
  voice: TTSVoice;
}

export interface TTSAudioState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  progress: number; // 0-100
  error: string | null;
}

export interface TTSAudioControls {
  play: (text: string, config?: Partial<TTSConfig>) => Promise<void>;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  cleanup: () => void;
}

export interface UseTTSAudioReturn extends TTSAudioState, TTSAudioControls {}

const DEFAULT_TTS_CONFIG: TTSConfig = {
  engine: 'standard',
  voice: {
    language: 'en-US',
    name: 'Joanna',
    engine: 'neural',
    displayName: 'Joanna (US, Neural)'
  }
};

export const useTTSAudio = (initialConfig?: Partial<TTSConfig>): UseTTSAudioReturn => {
  const [state, setState] = useState<TTSAudioState>({
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    progress: 0,
    error: null
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const configRef = useRef<TTSConfig>({ ...DEFAULT_TTS_CONFIG, ...initialConfig });
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced progress update for better performance
  const updateProgress = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      const currentTime = audioRef.current.currentTime;
      const duration = audioRef.current.duration || 0;
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

      setState(prev => ({
        ...prev,
        currentTime,
        duration,
        progress
      }));
    }
  }, []);

  // Debounced version of updateProgress to reduce re-renders
  const debouncedUpdateProgress = useCallback(() => {
    // Use requestAnimationFrame for smooth updates without overwhelming the UI
    if (progressIntervalRef.current) {
      updateProgress();
    }
  }, [updateProgress]);

  // Start progress tracking with debouncing for better performance
  const startProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    // Use requestAnimationFrame for smoother updates and better performance
    const trackProgress = () => {
      debouncedUpdateProgress();
      if (audioRef.current && !audioRef.current.paused) {
        progressIntervalRef.current = setTimeout(() => {
          requestAnimationFrame(trackProgress);
        }, 100); // Update every 100ms but use RAF for smooth rendering
      }
    };
    requestAnimationFrame(trackProgress);
  }, [debouncedUpdateProgress]);

  // Stop progress tracking with proper cleanup
  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearTimeout(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Store event handlers for proper cleanup
  const eventHandlersRef = useRef<{
    loadedmetadata?: () => void;
    timeupdate?: () => void;
    ended?: () => void;
    error?: (error: Event) => void;
  }>({});

  // Cleanup audio element and event listeners
  const cleanup = useCallback(() => {
    stopProgressTracking();
    
    if (audioRef.current) {
      // Pause audio
      audioRef.current.pause();
      
      // Remove event listeners using stored references
      const handlers = eventHandlersRef.current;
      if (handlers.loadedmetadata) {
        audioRef.current.removeEventListener('loadedmetadata', handlers.loadedmetadata);
      }
      if (handlers.timeupdate) {
        audioRef.current.removeEventListener('timeupdate', handlers.timeupdate);
      }
      if (handlers.ended) {
        audioRef.current.removeEventListener('ended', handlers.ended);
      }
      if (handlers.error) {
        audioRef.current.removeEventListener('error', handlers.error);
      }
      
      // Clear audio source and reference
      audioRef.current.src = '';
      audioRef.current = null;
    }

    // Clear event handler references
    eventHandlersRef.current = {};

    setState({
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      progress: 0,
      error: null
    });
  }, [stopProgressTracking]);

  // Play TTS audio
  const play = useCallback(async (text: string, config?: Partial<TTSConfig>) => {
    if (!text.trim()) {
      setState(prev => ({ ...prev, error: 'No text provided for TTS' }));
      return;
    }

    // Update config if provided
    if (config) {
      configRef.current = { ...configRef.current, ...config };
    }

    // Cleanup any existing audio
    cleanup();

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null 
    }));

    try {
      const currentConfig = configRef.current;
      let audio;
      
      // Validate and prepare TTS parameters
      const ttsParams = {
        voice: currentConfig.voice.name,
        engine: currentConfig.voice.engine,
        language: currentConfig.voice.language
      };

      console.log('Attempting TTS with configuration:', ttsParams);
      
      // Helper function to check if TTS response is successful
      const isSuccessfulTTSResponse = (response: any): boolean => {
        // Handle both direct audio response and {success, error} format
        if (response && typeof response === 'object') {
          // If it has success property, check it
          if ('success' in response) {
            return response.success === true;
          }
          // If it looks like an audio element, consider it successful
          if (response.play && typeof response.play === 'function') {
            return true;
          }
        }
        return false;
      };

      // Helper function to extract error message from TTS response
      const getTTSErrorMessage = (response: any): string => {
        if (response && response.error) {
          if (response.error.code === 'insufficient_funds') {
            return 'TTS service requires payment. Using browser speech synthesis as fallback.';
          }
          return response.error.message || 'TTS service error';
        }
        return 'Unknown TTS error';
      };

      try {
        // Primary attempt: Use configured engine and voice settings
        const primaryResponse = await puter.ai.txt2speech(text, ttsParams);
        
        if (isSuccessfulTTSResponse(primaryResponse)) {
          audio = primaryResponse;
          console.log('Primary TTS succeeded with configured settings');
        } else {
          console.warn('Primary TTS failed with configured settings:', getTTSErrorMessage(primaryResponse));
          
          // Check if this is an insufficient funds error - if so, skip other attempts and go to browser fallback
          if (primaryResponse?.error?.code === 'insufficient_funds') {
            console.log('Insufficient funds detected, using browser speech synthesis fallback');
            
            // Use browser's built-in speech synthesis as fallback
            if ('speechSynthesis' in window) {
              console.log('Using browser speech synthesis as fallback');
              
              // Load voices if not already loaded
              let voices = speechSynthesis.getVoices();
              if (voices.length === 0) {
                // Wait for voices to load
                await new Promise<void>((resolve) => {
                  const checkVoices = () => {
                    voices = speechSynthesis.getVoices();
                    if (voices.length > 0) {
                      resolve();
                    } else {
                      setTimeout(checkVoices, 100);
                    }
                  };
                  speechSynthesis.onvoiceschanged = checkVoices;
                  checkVoices();
                });
              }
              
              const utterance = new SpeechSynthesisUtterance(text);
              
              // Try to match voice settings if possible
              const matchingVoice = voices.find(voice => 
                voice.name.toLowerCase().includes(currentConfig.voice.name.toLowerCase()) ||
                voice.lang.startsWith(currentConfig.voice.language.split('-')[0])
              );
              
              if (matchingVoice) {
                utterance.voice = matchingVoice;
                console.log('Using matching browser voice:', matchingVoice.name);
              } else {
                console.log('No matching voice found, using default browser voice');
              }
              
              // Set speech rate and pitch for better quality
              utterance.rate = 0.9;
              utterance.pitch = 1.0;
              utterance.volume = 1.0;
              
              // Create a fake audio element that mimics the expected interface
              let isPlaying = false;
              let isPaused = false;
              let startTime = 0;
              const estimatedDuration = Math.max(text.length * 0.08, 1); // More accurate estimate
              
              const fakeAudio = {
                play: () => {
                  return new Promise<void>((resolve, reject) => {
                    if (isPlaying) {
                      resolve();
                      return;
                    }
                    
                    isPlaying = true;
                    isPaused = false;
                    startTime = Date.now();
                    
                    utterance.onstart = () => {
                      console.log('Browser TTS started');
                    };
                    
                    utterance.onend = () => {
                      isPlaying = false;
                      console.log('Browser TTS ended');
                      resolve();
                    };
                    
                    utterance.onerror = (event) => {
                      isPlaying = false;
                      console.error('Browser TTS error:', event);
                      reject(new Error('Browser speech synthesis failed'));
                    };
                    
                    try {
                      speechSynthesis.speak(utterance);
                    } catch (error) {
                      isPlaying = false;
                      reject(error);
                    }
                  });
                },
                pause: () => {
                  if (isPlaying) {
                    speechSynthesis.cancel();
                    isPlaying = false;
                    isPaused = true;
                  }
                },
                get currentTime() {
                  if (isPlaying && startTime > 0) {
                    return Math.min((Date.now() - startTime) / 1000, estimatedDuration);
                  }
                  return 0;
                },
                set currentTime(value: number) {
                  // Seeking not supported in speech synthesis
                },
                get duration() {
                  return estimatedDuration;
                },
                get paused() {
                  return !isPlaying;
                },
                addEventListener: (event: string, handler: any) => {
                  // Basic event listener support
                  if (event === 'loadedmetadata') {
                    setTimeout(handler, 0);
                  }
                },
                removeEventListener: () => {
                  // No-op for cleanup
                }
              };
              
              audio = fakeAudio as any;
            } else {
              throw new Error('TTS service unavailable and browser speech synthesis not supported');
            }
          } else {
            // Try other configurations for non-funding errors
            // Secondary attempt: Try with just the voice name
            try {
              console.log('Attempting TTS with voice only:', { voice: currentConfig.voice.name });
              const secondaryResponse = await puter.ai.txt2speech(text, {
                voice: currentConfig.voice.name
              });
              
              if (isSuccessfulTTSResponse(secondaryResponse)) {
                audio = secondaryResponse;
                console.log('Secondary TTS succeeded with voice only');
              } else {
                console.warn('Secondary TTS failed with voice only:', getTTSErrorMessage(secondaryResponse));
                
                // Final fallback: Standard TTS without specific configuration
                console.log('Attempting final fallback TTS without configuration');
                const fallbackResponse = await puter.ai.txt2speech(text);
                
                if (isSuccessfulTTSResponse(fallbackResponse)) {
                  audio = fallbackResponse;
                  console.log('Final fallback TTS succeeded');
                } else {
                  console.error('All TTS attempts failed:', getTTSErrorMessage(fallbackResponse));
                  throw new Error(getTTSErrorMessage(fallbackResponse));
                }
              }
            } catch (secondaryError) {
              console.warn('Secondary TTS attempt threw error:', secondaryError);
              throw secondaryError;
            }
          }
        }
      } catch (primaryError) {
        console.warn('Primary TTS threw error:', primaryError);
        
        // If we get here, try browser speech synthesis as final fallback
        if ('speechSynthesis' in window) {
          console.log('Using browser speech synthesis as final fallback');
          
          // Load voices if not already loaded
          let voices = speechSynthesis.getVoices();
          if (voices.length === 0) {
            // Wait for voices to load
            await new Promise<void>((resolve) => {
              const checkVoices = () => {
                voices = speechSynthesis.getVoices();
                if (voices.length > 0) {
                  resolve();
                } else {
                  setTimeout(checkVoices, 100);
                }
              };
              speechSynthesis.onvoiceschanged = checkVoices;
              checkVoices();
            });
          }
          
          const utterance = new SpeechSynthesisUtterance(text);
          
          // Try to match voice settings if possible
          const matchingVoice = voices.find(voice => 
            voice.name.toLowerCase().includes(currentConfig.voice.name.toLowerCase()) ||
            voice.lang.startsWith(currentConfig.voice.language.split('-')[0])
          );
          
          if (matchingVoice) {
            utterance.voice = matchingVoice;
            console.log('Using matching browser voice:', matchingVoice.name);
          } else {
            console.log('No matching voice found, using default browser voice');
          }
          
          // Set speech rate and pitch for better quality
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;
          
          // Create a fake audio element that mimics the expected interface
          let isPlaying = false;
          let isPaused = false;
          let startTime = 0;
          const estimatedDuration = Math.max(text.length * 0.08, 1);
          
          const fakeAudio = {
            play: () => {
              return new Promise<void>((resolve, reject) => {
                if (isPlaying) {
                  resolve();
                  return;
                }
                
                isPlaying = true;
                isPaused = false;
                startTime = Date.now();
                
                utterance.onstart = () => {
                  console.log('Browser TTS started');
                };
                
                utterance.onend = () => {
                  isPlaying = false;
                  console.log('Browser TTS ended');
                  resolve();
                };
                
                utterance.onerror = (event) => {
                  isPlaying = false;
                  console.error('Browser TTS error:', event);
                  reject(new Error('Browser speech synthesis failed'));
                };
                
                try {
                  speechSynthesis.speak(utterance);
                } catch (error) {
                  isPlaying = false;
                  reject(error);
                }
              });
            },
            pause: () => {
              if (isPlaying) {
                speechSynthesis.cancel();
                isPlaying = false;
                isPaused = true;
              }
            },
            get currentTime() {
              if (isPlaying && startTime > 0) {
                return Math.min((Date.now() - startTime) / 1000, estimatedDuration);
              }
              return 0;
            },
            set currentTime(value: number) {
              // Seeking not supported in speech synthesis
            },
            get duration() {
              return estimatedDuration;
            },
            get paused() {
              return !isPlaying;
            },
            addEventListener: (event: string, handler: any) => {
              // Basic event listener support
              if (event === 'loadedmetadata') {
                setTimeout(handler, 0);
              }
            },
            removeEventListener: () => {
              // No-op for cleanup
            }
          };
          
          audio = fakeAudio as any;
        } else {
          throw new Error('TTS service unavailable and browser speech synthesis not supported');
        }
      }

      if (!audio) {
        throw new Error('Failed to generate TTS audio');
      }

      audioRef.current = audio;

      // Set up event listeners with proper references for cleanup
      const handleLoadedMetadata = () => {
        setState(prev => ({
          ...prev,
          isLoading: false,
          duration: audio.duration || 0
        }));
      };

      const handleTimeUpdate = () => {
        updateProgress();
      };

      const handleEnded = () => {
        stopProgressTracking();
        setState(prev => ({
          ...prev,
          isPlaying: false,
          currentTime: 0,
          progress: 0
        }));
      };

      const handleError = (error: Event) => {
        console.error('Audio playback error:', error);
        cleanup();
        setState(prev => ({
          ...prev,
          error: 'Audio playback failed'
        }));
      };

      // Store event handler references for proper cleanup
      eventHandlersRef.current = {
        loadedmetadata: handleLoadedMetadata,
        timeupdate: handleTimeUpdate,
        ended: handleEnded,
        error: handleError
      };

      // Add event listeners
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      // Start playback
      await audio.play();
      
      setState(prev => ({
        ...prev,
        isPlaying: true,
        isLoading: false
      }));

      startProgressTracking();

    } catch (error) {
      console.error('TTS error:', error);
      
      let errorMessage = 'TTS generation failed';
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error - check your connection';
        } else if (error.message.includes('voice') || error.message.includes('engine')) {
          errorMessage = 'Unsupported voice or engine configuration';
        }
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  }, [cleanup, updateProgress, startProgressTracking, stopProgressTracking]);

  // Stop audio playback
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    stopProgressTracking();
    
    setState(prev => ({
      ...prev,
      isPlaying: false,
      currentTime: 0,
      progress: 0
    }));
  }, [stopProgressTracking]);

  // Seek to specific time
  const seek = useCallback((time: number) => {
    if (audioRef.current && audioRef.current.duration) {
      const clampedTime = Math.max(0, Math.min(time, audioRef.current.duration));
      audioRef.current.currentTime = clampedTime;
      
      setState(prev => ({
        ...prev,
        currentTime: clampedTime,
        progress: (clampedTime / audioRef.current!.duration) * 100
      }));
    }
  }, []);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      audioRef.current.volume = clampedVolume;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // State
    isPlaying: state.isPlaying,
    isLoading: state.isLoading,
    currentTime: state.currentTime,
    duration: state.duration,
    progress: state.progress,
    error: state.error,
    
    // Controls
    play,
    stop,
    seek,
    setVolume,
    cleanup
  };
};

// Available TTS voices configuration
export const AVAILABLE_TTS_VOICES: TTSVoice[] = [
  { 
    language: 'en-IE', 
    name: 'Niamh', 
    engine: 'neural', 
    displayName: 'Niamh (Irish, Neural)' 
  },
  { 
    language: 'en-GB', 
    name: 'Amy', 
    engine: 'generative', 
    displayName: 'Amy (British, Generative)' 
  },
  { 
    language: 'en-GB', 
    name: 'Brian', 
    engine: 'standard', 
    displayName: 'Brian (British, Standard)' 
  },
  { 
    language: 'en-US', 
    name: 'Mathew', 
    engine: 'generative', 
    displayName: 'Mathew (US, Generative)' 
  },
  { 
    language: 'en-US', 
    name: 'Joanna', 
    engine: 'neural', 
    displayName: 'Joanna (US, Neural)' 
  }
];

// Helper function to get default voice for an engine
export const getDefaultVoiceForEngine = (engine: 'standard' | 'neural' | 'generative'): TTSVoice => {
  const voice = AVAILABLE_TTS_VOICES.find(v => v.engine === engine);
  return voice || AVAILABLE_TTS_VOICES[0];
};

// Helper function to validate TTS configuration
export const validateTTSConfig = (config: Partial<TTSConfig>): TTSConfig => {
  const validEngines: Array<'standard' | 'neural' | 'generative'> = ['standard', 'neural', 'generative'];
  
  let engine: 'standard' | 'neural' | 'generative' = 'standard';
  if (config.engine && validEngines.includes(config.engine)) {
    engine = config.engine;
  }

  let voice = config.voice;
  if (!voice || !AVAILABLE_TTS_VOICES.find(v => 
    v.language === voice.language && 
    v.name === voice.name && 
    v.engine === voice.engine
  )) {
    voice = getDefaultVoiceForEngine(engine);
  }

  return { engine, voice };
};

// Helper function to test TTS configuration compatibility
export const testTTSConfig = async (config: TTSConfig, testText: string = "Test"): Promise<boolean> => {
  try {
    // Declare puter for testing
    declare const puter: any;
    
    const audio = await puter.ai.txt2speech(testText, {
      voice: config.voice.name,
      engine: config.voice.engine,
      language: config.voice.language
    });
    
    // Clean up test audio
    if (audio && typeof audio.pause === 'function') {
      audio.pause();
    }
    
    return true;
  } catch (error) {
    console.warn('TTS config test failed:', error);
    return false;
  }
};

// Helper function to get compatible voice for engine
export const getCompatibleVoice = (preferredVoice: TTSVoice, engine: 'standard' | 'neural' | 'generative'): TTSVoice => {
  // First try to find the exact voice
  const exactMatch = AVAILABLE_TTS_VOICES.find(v => 
    v.language === preferredVoice.language && 
    v.name === preferredVoice.name && 
    v.engine === engine
  );
  
  if (exactMatch) return exactMatch;
  
  // Try to find same voice with different engine
  const sameVoice = AVAILABLE_TTS_VOICES.find(v => 
    v.name === preferredVoice.name && 
    v.engine === engine
  );
  
  if (sameVoice) return sameVoice;
  
  // Fall back to any voice with the requested engine
  return getDefaultVoiceForEngine(engine);
};