import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useTTSAudio, TTSConfig, AVAILABLE_TTS_VOICES, validateTTSConfig, getDefaultVoiceForEngine } from '../useTTSAudio'

// Mock audio element
const createMockAudio = () => ({
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  load: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  currentTime: 0,
  duration: 100,
  paused: true,
  volume: 1,
  src: '',
})

describe('useTTSAudio', () => {
  let mockAudio: ReturnType<typeof createMockAudio>
  
  beforeEach(() => {
    mockAudio = createMockAudio()
    
    // Mock puter API
    global.puter = {
      ai: {
        txt2speech: vi.fn().mockResolvedValue(mockAudio)
      }
    }
    
    // Reset console mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useTTSAudio())
      
      expect(result.current.isPlaying).toBe(false)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.currentTime).toBe(0)
      expect(result.current.duration).toBe(0)
      expect(result.current.progress).toBe(0)
      expect(result.current.error).toBe(null)
    })

    it('should accept initial config', () => {
      const config: Partial<TTSConfig> = {
        engine: 'neural',
        voice: AVAILABLE_TTS_VOICES[0]
      }
      
      const { result } = renderHook(() => useTTSAudio(config))
      
      expect(result.current.isPlaying).toBe(false)
      expect(result.current.error).toBe(null)
    })
  })

  describe('Play Functionality', () => {
    it('should play TTS audio successfully', async () => {
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      expect(global.puter.ai.txt2speech).toHaveBeenCalledWith(
        'Hello world',
        expect.objectContaining({
          voice: expect.any(String),
          engine: expect.any(String),
          language: expect.any(String)
        })
      )
      expect(mockAudio.play).toHaveBeenCalled()
      expect(result.current.isPlaying).toBe(true)
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle empty text', async () => {
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('')
      })
      
      expect(result.current.error).toBe('No text provided for TTS')
      expect(result.current.isPlaying).toBe(false)
    })

    it('should handle TTS API failure with fallback', async () => {
      // Mock puter to fail
      global.puter.ai.txt2speech = vi.fn().mockRejectedValue(new Error('API Error'))
      
      // Mock speechSynthesis for fallback
      const mockUtterance = { onstart: null, onend: null, onerror: null }
      global.SpeechSynthesisUtterance = vi.fn().mockImplementation(() => mockUtterance)
      
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      // Should attempt fallback to browser TTS
      expect(window.speechSynthesis.speak).toHaveBeenCalled()
    })

    it('should use custom config when provided', async () => {
      const { result } = renderHook(() => useTTSAudio())
      
      const customConfig: Partial<TTSConfig> = {
        engine: 'generative',
        voice: AVAILABLE_TTS_VOICES[1]
      }
      
      await act(async () => {
        await result.current.play('Hello world', customConfig)
      })
      
      expect(global.puter.ai.txt2speech).toHaveBeenCalledWith(
        'Hello world',
        expect.objectContaining({
          voice: customConfig.voice!.name,
          engine: customConfig.voice!.engine,
          language: customConfig.voice!.language
        })
      )
    })

    it('should set loading state during TTS generation', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise(resolve => {
        resolvePromise = resolve
      })
      
      global.puter.ai.txt2speech = vi.fn().mockReturnValue(promise)
      
      const { result } = renderHook(() => useTTSAudio())
      
      act(() => {
        result.current.play('Hello world')
      })
      
      expect(result.current.isLoading).toBe(true)
      expect(result.current.isPlaying).toBe(false)
      
      await act(async () => {
        resolvePromise!(mockAudio)
      })
      
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isPlaying).toBe(true)
    })
  })

  describe('Stop Functionality', () => {
    it('should stop audio playback', async () => {
      const { result } = renderHook(() => useTTSAudio())
      
      // First play audio
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      expect(result.current.isPlaying).toBe(true)
      
      // Then stop it
      act(() => {
        result.current.stop()
      })
      
      expect(mockAudio.pause).toHaveBeenCalled()
      expect(result.current.isPlaying).toBe(false)
      expect(result.current.currentTime).toBe(0)
      expect(result.current.progress).toBe(0)
    })

    it('should handle stop when no audio is playing', () => {
      const { result } = renderHook(() => useTTSAudio())
      
      act(() => {
        result.current.stop()
      })
      
      expect(result.current.isPlaying).toBe(false)
    })
  })

  describe('Seek Functionality', () => {
    it('should seek to specific time', async () => {
      const { result } = renderHook(() => useTTSAudio())
      
      // First play audio
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      // Mock audio duration
      Object.defineProperty(mockAudio, 'duration', { value: 100, writable: true })
      
      act(() => {
        result.current.seek(50)
      })
      
      expect(mockAudio.currentTime).toBe(50)
    })

    it('should clamp seek time to valid range', async () => {
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      Object.defineProperty(mockAudio, 'duration', { value: 100, writable: true })
      
      // Test negative time
      act(() => {
        result.current.seek(-10)
      })
      expect(mockAudio.currentTime).toBe(0)
      
      // Test time beyond duration
      act(() => {
        result.current.seek(150)
      })
      expect(mockAudio.currentTime).toBe(100)
    })

    it('should handle seek when no audio is loaded', () => {
      const { result } = renderHook(() => useTTSAudio())
      
      act(() => {
        result.current.seek(50)
      })
      
      // Should not throw error
      expect(result.current.currentTime).toBe(0)
    })
  })

  describe('Volume Control', () => {
    it('should set volume', async () => {
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      act(() => {
        result.current.setVolume(0.5)
      })
      
      expect(mockAudio.volume).toBe(0.5)
    })

    it('should clamp volume to valid range', async () => {
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      // Test negative volume
      act(() => {
        result.current.setVolume(-0.5)
      })
      expect(mockAudio.volume).toBe(0)
      
      // Test volume above 1
      act(() => {
        result.current.setVolume(1.5)
      })
      expect(mockAudio.volume).toBe(1)
    })
  })

  describe('Progress Tracking', () => {
    it('should update progress during playback', async () => {
      vi.useFakeTimers()
      
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      // Mock audio properties for progress calculation
      Object.defineProperty(mockAudio, 'currentTime', { value: 25, writable: true })
      Object.defineProperty(mockAudio, 'duration', { value: 100, writable: true })
      Object.defineProperty(mockAudio, 'paused', { value: false, writable: true })
      
      // Trigger progress update
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      await waitFor(() => {
        expect(result.current.progress).toBe(25)
        expect(result.current.currentTime).toBe(25)
        expect(result.current.duration).toBe(100)
      })
      
      vi.useRealTimers()
    })
  })

  describe('Error Handling', () => {
    it('should handle TTS API errors', async () => {
      global.puter.ai.txt2speech = vi.fn().mockRejectedValue(new Error('Network error'))
      
      // Mock speechSynthesis to also fail
      window.speechSynthesis = undefined as any
      
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      expect(result.current.error).toBeTruthy()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isPlaying).toBe(false)
    })

    it('should handle audio playback errors', async () => {
      mockAudio.play = vi.fn().mockRejectedValue(new Error('Playback failed'))
      
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      expect(result.current.error).toBeTruthy()
      expect(result.current.isPlaying).toBe(false)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup on unmount', async () => {
      const { result, unmount } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      expect(result.current.isPlaying).toBe(true)
      
      unmount()
      
      expect(mockAudio.pause).toHaveBeenCalled()
      expect(mockAudio.removeEventListener).toHaveBeenCalled()
    })

    it('should cleanup when calling cleanup method', async () => {
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      act(() => {
        result.current.cleanup()
      })
      
      expect(mockAudio.pause).toHaveBeenCalled()
      expect(result.current.isPlaying).toBe(false)
      expect(result.current.currentTime).toBe(0)
      expect(result.current.duration).toBe(0)
      expect(result.current.progress).toBe(0)
    })
  })

  describe('Audio Event Handling', () => {
    it('should handle loadedmetadata event', async () => {
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      // Simulate loadedmetadata event
      const loadedMetadataHandler = mockAudio.addEventListener.mock.calls
        .find(call => call[0] === 'loadedmetadata')?.[1]
      
      if (loadedMetadataHandler) {
        act(() => {
          loadedMetadataHandler()
        })
        
        expect(result.current.isLoading).toBe(false)
      }
    })

    it('should handle ended event', async () => {
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      // Simulate ended event
      const endedHandler = mockAudio.addEventListener.mock.calls
        .find(call => call[0] === 'ended')?.[1]
      
      if (endedHandler) {
        act(() => {
          endedHandler()
        })
        
        expect(result.current.isPlaying).toBe(false)
        expect(result.current.currentTime).toBe(0)
        expect(result.current.progress).toBe(0)
      }
    })

    it('should handle error event', async () => {
      const { result } = renderHook(() => useTTSAudio())
      
      await act(async () => {
        await result.current.play('Hello world')
      })
      
      // Simulate error event
      const errorHandler = mockAudio.addEventListener.mock.calls
        .find(call => call[0] === 'error')?.[1]
      
      if (errorHandler) {
        act(() => {
          errorHandler(new Event('error'))
        })
        
        expect(result.current.error).toBeTruthy()
        expect(result.current.isPlaying).toBe(false)
      }
    })
  })
})

describe('TTS Utility Functions', () => {
  describe('validateTTSConfig', () => {
    it('should validate and return valid config', () => {
      const config = {
        engine: 'neural' as const,
        voice: AVAILABLE_TTS_VOICES[0]
      }
      
      const validated = validateTTSConfig(config)
      
      expect(validated.engine).toBe('neural')
      expect(validated.voice).toEqual(AVAILABLE_TTS_VOICES[0])
    })

    it('should use defaults for invalid config', () => {
      const config = {
        engine: 'invalid' as any,
        voice: { language: 'invalid', name: 'invalid', engine: 'invalid' as any, displayName: 'invalid' }
      }
      
      const validated = validateTTSConfig(config)
      
      expect(validated.engine).toBe('standard')
      expect(AVAILABLE_TTS_VOICES).toContain(validated.voice)
    })

    it('should handle empty config', () => {
      const validated = validateTTSConfig({})
      
      expect(validated.engine).toBe('standard')
      expect(AVAILABLE_TTS_VOICES).toContain(validated.voice)
    })
  })

  describe('getDefaultVoiceForEngine', () => {
    it('should return voice for each engine type', () => {
      const standardVoice = getDefaultVoiceForEngine('standard')
      const neuralVoice = getDefaultVoiceForEngine('neural')
      const generativeVoice = getDefaultVoiceForEngine('generative')
      
      expect(standardVoice.engine).toBe('standard')
      expect(neuralVoice.engine).toBe('neural')
      expect(generativeVoice.engine).toBe('generative')
    })

    it('should fallback to first voice if engine not found', () => {
      // This shouldn't happen with valid engines, but test defensive coding
      const voice = getDefaultVoiceForEngine('nonexistent' as any)
      expect(voice).toEqual(AVAILABLE_TTS_VOICES[0])
    })
  })

  describe('AVAILABLE_TTS_VOICES', () => {
    it('should contain all required voice configurations', () => {
      expect(AVAILABLE_TTS_VOICES).toHaveLength(5)
      
      const engines = AVAILABLE_TTS_VOICES.map(v => v.engine)
      expect(engines).toContain('standard')
      expect(engines).toContain('neural')
      expect(engines).toContain('generative')
      
      const languages = AVAILABLE_TTS_VOICES.map(v => v.language)
      expect(languages).toContain('en-US')
      expect(languages).toContain('en-GB')
      expect(languages).toContain('en-IE')
    })

    it('should have valid voice structure', () => {
      AVAILABLE_TTS_VOICES.forEach(voice => {
        expect(voice).toHaveProperty('language')
        expect(voice).toHaveProperty('name')
        expect(voice).toHaveProperty('engine')
        expect(voice).toHaveProperty('displayName')
        
        expect(typeof voice.language).toBe('string')
        expect(typeof voice.name).toBe('string')
        expect(['standard', 'neural', 'generative']).toContain(voice.engine)
        expect(typeof voice.displayName).toBe('string')
      })
    })
  })
})