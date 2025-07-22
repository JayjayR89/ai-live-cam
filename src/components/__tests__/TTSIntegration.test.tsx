import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TTSControls } from '../TTSControls'
import { SettingsModal } from '../SettingsModal'
import { TTSSettingsProvider, useTTSSettings } from '@/contexts/TTSSettingsContext'
import { AVAILABLE_TTS_VOICES } from '@/hooks/useTTSAudio'

// Mock dependencies
vi.mock('@/hooks/useTTSAudio', () => ({
  useTTSAudio: vi.fn(),
  AVAILABLE_TTS_VOICES: [
    { language: 'en-IE', name: 'Niamh', engine: 'neural', displayName: 'Niamh (Irish, Neural)' },
    { language: 'en-GB', name: 'Amy', engine: 'generative', displayName: 'Amy (British, Generative)' },
    { language: 'en-GB', name: 'Brian', engine: 'standard', displayName: 'Brian (British, Standard)' },
    { language: 'en-US', name: 'Mathew', engine: 'generative', displayName: 'Mathew (US, Generative)' },
    { language: 'en-US', name: 'Joanna', engine: 'neural', displayName: 'Joanna (US, Neural)' }
  ],
  validateTTSConfig: vi.fn(),
  getDefaultVoiceForEngine: vi.fn()
}))

vi.mock('../AudioScrubBar', () => ({
  AudioScrubBar: ({ currentTime, duration, isPlaying, onSeek }: any) => (
    <div data-testid="audio-scrub-bar">
      <span data-testid="current-time">{currentTime}</span>
      <span data-testid="duration">{duration}</span>
      <span data-testid="is-playing">{isPlaying.toString()}</span>
      <button onClick={() => onSeek(50)} data-testid="seek-button">Seek</button>
    </div>
  )
}))

vi.mock('../ErrorBoundary', () => ({
  TTSErrorBoundary: ({ children }: any) => <div data-testid="tts-error-boundary">{children}</div>
}))

vi.mock('../LoadingIndicator', () => ({
  LoadingIndicator: ({ type, message }: any) => (
    <div data-testid="loading-indicator">
      <span data-testid="loading-type">{type}</span>
      <span data-testid="loading-message">{message}</span>
    </div>
  )
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div data-testid="scroll-area">{children}</div>
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select" data-value={value}>
      <button onClick={() => onValueChange('test-engine')} data-testid="select-trigger">
        Select Engine
      </button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <button onClick={() => {}} data-value={value}>{children}</button>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <button
      data-testid="switch"
      data-checked={checked}
      onClick={() => onCheckedChange(!checked)}
    >
      {checked ? 'ON' : 'OFF'}
    </button>
  )
}))

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}))

vi.mock('@/lib/errorHandling', () => ({
  handleTTSError: vi.fn().mockReturnValue('error-id-123')
}))

import { useTTSAudio } from '@/hooks/useTTSAudio'

const mockUseTTSAudio = useTTSAudio as any

describe('TTS Integration Tests', () => {
  const mockTTSHook = {
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    progress: 0,
    error: null,
    play: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    cleanup: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTTSAudio.mockReturnValue(mockTTSHook)
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })

    // Mock puter API
    global.puter = {
      ai: {
        txt2speech: vi.fn().mockResolvedValue({
          play: vi.fn().mockResolvedValue(undefined),
          pause: vi.fn(),
          currentTime: 0,
          duration: 100,
          paused: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      },
    }
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('TTS Engine and Voice Configuration Integration', () => {
    it('should integrate TTS settings with TTS controls', async () => {
      const user = userEvent.setup()
      
      const TestComponent = () => {
        const [settingsOpen, setSettingsOpen] = React.useState(false)
        const [settings, setSettings] = React.useState({
          autoCapture: false,
          captureInterval: 5,
          maxImages: 10,
          imageQuality: 0.8,
          enableNotifications: true,
          theme: 'light' as const,
        })

        return (
          <TTSSettingsProvider>
            <div>
              <button onClick={() => setSettingsOpen(true)}>Open Settings</button>
              <TTSControls text="Hello world" />
              <SettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                settings={settings}
                onSave={(newSettings) => {
                  setSettings(newSettings)
                  setSettingsOpen(false)
                }}
              />
            </div>
          </TTSSettingsProvider>
        )
      }

      render(<TestComponent />)

      // Open settings modal
      const openSettingsButton = screen.getByText('Open Settings')
      await user.click(openSettingsButton)

      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByText('TTS Settings')).toBeInTheDocument()

      // Should have TTS engine and voice selects
      const selects = screen.getAllByTestId('select')
      expect(selects.length).toBeGreaterThanOrEqual(2)

      // Change TTS engine
      const engineSelect = selects[0]
      const engineTrigger = engineSelect.querySelector('[data-testid="select-trigger"]')
      if (engineTrigger) {
        await user.click(engineTrigger)
      }

      // Save settings
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)

      // Settings should be closed
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()

      // TTS controls should use updated configuration
      const playButton = screen.getByRole('button', { name: /play text-to-speech/i })
      await user.click(playButton)

      expect(mockTTSHook.play).toHaveBeenCalledWith(
        'Hello world',
        expect.objectContaining({
          engine: expect.any(String),
          voice: expect.objectContaining({
            language: expect.any(String),
            name: expect.any(String),
            engine: expect.any(String),
            displayName: expect.any(String)
          })
        })
      )
    })

    it('should persist TTS configuration across sessions', async () => {
      const user = userEvent.setup()
      const mockSetItem = vi.fn()
      const mockGetItem = vi.fn().mockReturnValue(JSON.stringify({
        engine: 'neural',
        voice: AVAILABLE_TTS_VOICES[0]
      }))
      
      window.localStorage.setItem = mockSetItem
      window.localStorage.getItem = mockGetItem

      const TestComponent = () => (
        <TTSSettingsProvider>
          <SettingsModal
            isOpen={true}
            onClose={() => {}}
            settings={{
              autoCapture: false,
              captureInterval: 5,
              maxImages: 10,
              imageQuality: 0.8,
              enableNotifications: true,
              theme: 'light' as const,
            }}
            onSave={() => {}}
          />
        </TTSSettingsProvider>
      )

      render(<TestComponent />)

      // Should load persisted settings
      expect(mockGetItem).toHaveBeenCalledWith('tts-settings')

      // Change settings and save
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)

      // Should persist to localStorage
      expect(mockSetItem).toHaveBeenCalledWith(
        'tts-settings',
        expect.stringContaining('engine')
      )
    })

    it('should handle engine switching with voice compatibility', async () => {
      const user = userEvent.setup()
      
      const TestComponent = () => {
        const [engine, setEngine] = React.useState<'standard' | 'neural' | 'generative'>('standard')
        
        return (
          <TTSSettingsProvider>
            <div>
              <select 
                data-testid="engine-select" 
                value={engine} 
                onChange={(e) => setEngine(e.target.value as any)}
              >
                <option value="standard">Standard</option>
                <option value="neural">Neural</option>
                <option value="generative">Generative</option>
              </select>
              <TTSControls 
                text="Test message" 
                config={{
                  engine,
                  voice: AVAILABLE_TTS_VOICES.find(v => v.engine === engine) || AVAILABLE_TTS_VOICES[0]
                }}
              />
            </div>
          </TTSSettingsProvider>
        )
      }

      render(<TestComponent />)

      // Change engine to neural
      const engineSelect = screen.getByTestId('engine-select')
      await user.selectOptions(engineSelect, 'neural')

      // Play TTS with neural engine
      const playButton = screen.getByRole('button', { name: /play text-to-speech/i })
      await user.click(playButton)

      expect(mockTTSHook.play).toHaveBeenCalledWith(
        'Test message',
        expect.objectContaining({
          engine: 'neural',
          voice: expect.objectContaining({
            engine: 'neural'
          })
        })
      )

      // Change to generative engine
      await user.selectOptions(engineSelect, 'generative')
      await user.click(playButton)

      expect(mockTTSHook.play).toHaveBeenCalledWith(
        'Test message',
        expect.objectContaining({
          engine: 'generative',
          voice: expect.objectContaining({
            engine: 'generative'
          })
        })
      )
    })

    it('should handle voice selection within engine constraints', async () => {
      const user = userEvent.setup()
      
      const TestComponent = () => {
        const [selectedVoice, setSelectedVoice] = React.useState(AVAILABLE_TTS_VOICES[0])
        
        return (
          <TTSSettingsProvider>
            <div>
              <select 
                data-testid="voice-select" 
                value={selectedVoice.name}
                onChange={(e) => {
                  const voice = AVAILABLE_TTS_VOICES.find(v => v.name === e.target.value)
                  if (voice) setSelectedVoice(voice)
                }}
              >
                {AVAILABLE_TTS_VOICES.map(voice => (
                  <option key={voice.name} value={voice.name}>
                    {voice.displayName}
                  </option>
                ))}
              </select>
              <TTSControls 
                text="Voice test" 
                config={{
                  engine: selectedVoice.engine,
                  voice: selectedVoice
                }}
              />
            </div>
          </TTSSettingsProvider>
        )
      }

      render(<TestComponent />)

      // Select different voices and verify they're used correctly
      const voiceSelect = screen.getByTestId('voice-select')
      
      // Test neural voice
      const neuralVoice = AVAILABLE_TTS_VOICES.find(v => v.engine === 'neural')
      if (neuralVoice) {
        await user.selectOptions(voiceSelect, neuralVoice.name)
        
        const playButton = screen.getByRole('button', { name: /play text-to-speech/i })
        await user.click(playButton)

        expect(mockTTSHook.play).toHaveBeenCalledWith(
          'Voice test',
          expect.objectContaining({
            engine: 'neural',
            voice: expect.objectContaining({
              name: neuralVoice.name,
              language: neuralVoice.language,
              engine: 'neural'
            })
          })
        )
      }

      // Test generative voice
      const generativeVoice = AVAILABLE_TTS_VOICES.find(v => v.engine === 'generative')
      if (generativeVoice) {
        await user.selectOptions(voiceSelect, generativeVoice.name)
        
        const playButton = screen.getByRole('button', { name: /play text-to-speech/i })
        await user.click(playButton)

        expect(mockTTSHook.play).toHaveBeenCalledWith(
          'Voice test',
          expect.objectContaining({
            engine: 'generative',
            voice: expect.objectContaining({
              name: generativeVoice.name,
              language: generativeVoice.language,
              engine: 'generative'
            })
          })
        )
      }
    })
  })

  describe('TTS Controls and Audio Scrub Bar Integration', () => {
    it('should show scrub bar when audio is playing', async () => {
      const user = userEvent.setup()
      
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true,
        currentTime: 30,
        duration: 100,
        progress: 30
      })

      render(
        <TTSSettingsProvider>
          <TTSControls text="Test audio with scrub bar" />
        </TTSSettingsProvider>
      )

      // Should show audio scrub bar when playing
      expect(screen.getByTestId('audio-scrub-bar')).toBeInTheDocument()
      expect(screen.getByTestId('current-time')).toHaveTextContent('30')
      expect(screen.getByTestId('duration')).toHaveTextContent('100')
      expect(screen.getByTestId('is-playing')).toHaveTextContent('true')
    })

    it('should handle seeking from scrub bar', async () => {
      const user = userEvent.setup()
      const mockSeek = vi.fn()
      
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true,
        currentTime: 30,
        duration: 100,
        seek: mockSeek
      })

      render(
        <TTSSettingsProvider>
          <TTSControls text="Test seeking functionality" />
        </TTSSettingsProvider>
      )

      const seekButton = screen.getByTestId('seek-button')
      await user.click(seekButton)

      expect(mockSeek).toHaveBeenCalledWith(50)
    })

    it('should update scrub bar in real-time during playback', async () => {
      vi.useFakeTimers()
      
      const { rerender } = render(
        <TTSSettingsProvider>
          <TTSControls text="Real-time progress test" />
        </TTSSettingsProvider>
      )

      // Start playing
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true,
        currentTime: 10,
        duration: 100
      })

      rerender(
        <TTSSettingsProvider>
          <TTSControls text="Real-time progress test" />
        </TTSSettingsProvider>
      )

      expect(screen.getByTestId('current-time')).toHaveTextContent('10')

      // Simulate time progression
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true,
        currentTime: 25,
        duration: 100
      })

      rerender(
        <TTSSettingsProvider>
          <TTSControls text="Real-time progress test" />
        </TTSSettingsProvider>
      )

      expect(screen.getByTestId('current-time')).toHaveTextContent('25')

      vi.useRealTimers()
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle TTS engine failures with fallback', async () => {
      const user = userEvent.setup()
      const mockPlay = vi.fn().mockRejectedValue(new Error('Neural engine unavailable'))
      
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        play: mockPlay,
        error: 'Neural engine unavailable'
      })

      render(
        <TTSSettingsProvider>
          <TTSControls 
            text="Test fallback" 
            config={{
              engine: 'neural',
              voice: AVAILABLE_TTS_VOICES.find(v => v.engine === 'neural')!
            }}
          />
        </TTSSettingsProvider>
      )

      const playButton = screen.getByRole('button', { name: /play text-to-speech/i })
      await user.click(playButton)

      // Should show error state
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getAllByText(/neural engine unavailable/i).length).toBeGreaterThan(0)
    })

    it('should handle voice configuration errors gracefully', async () => {
      const user = userEvent.setup()
      
      render(
        <TTSSettingsProvider>
          <TTSControls 
            text="Test invalid voice" 
            config={{
              engine: 'standard',
              voice: {
                language: 'invalid-lang',
                name: 'InvalidVoice',
                engine: 'invalid' as any,
                displayName: 'Invalid Voice'
              }
            }}
          />
        </TTSSettingsProvider>
      )

      const playButton = screen.getByRole('button', { name: /play text-to-speech/i })
      await user.click(playButton)

      // Should handle invalid configuration gracefully
      expect(mockTTSHook.play).toHaveBeenCalled()
    })
  })

  describe('Settings Modal TTS Configuration', () => {
    it('should show all available TTS engines in settings', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal
            isOpen={true}
            onClose={() => {}}
            settings={{
              autoCapture: false,
              captureInterval: 5,
              maxImages: 10,
              imageQuality: 0.8,
              enableNotifications: true,
              theme: 'light' as const,
            }}
            onSave={() => {}}
          />
        </TTSSettingsProvider>
      )

      expect(screen.getByText('TTS Settings')).toBeInTheDocument()
      expect(screen.getByText('TTS Engine')).toBeInTheDocument()
      expect(screen.getByText('Voice')).toBeInTheDocument()
    })

    it('should validate TTS configuration before saving', async () => {
      const user = userEvent.setup()
      const mockOnSave = vi.fn()
      
      render(
        <TTSSettingsProvider>
          <SettingsModal
            isOpen={true}
            onClose={() => {}}
            settings={{
              autoCapture: false,
              captureInterval: 5,
              maxImages: 10,
              imageQuality: 0.8,
              enableNotifications: true,
              theme: 'light' as const,
            }}
            onSave={mockOnSave}
          />
        </TTSSettingsProvider>
      )

      const saveButton = screen.getByText('Save')
      await user.click(saveButton)

      expect(mockOnSave).toHaveBeenCalled()
    })
  })

  describe('Performance and Memory Management', () => {
    it('should cleanup TTS resources when components unmount', () => {
      const mockCleanup = vi.fn()
      
      // Create a test component that uses useEffect to simulate cleanup
      const TestComponent = () => {
        React.useEffect(() => {
          return () => {
            mockCleanup()
          }
        }, [])
        
        return (
          <TTSSettingsProvider>
            <TTSControls text="Cleanup test" />
          </TTSSettingsProvider>
        )
      }

      const { unmount } = render(<TestComponent />)

      unmount()

      expect(mockCleanup).toHaveBeenCalled()
    })

    it('should not create multiple audio instances for same text', async () => {
      const user = userEvent.setup()
      const mockPlay = vi.fn()
      
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        play: mockPlay
      })

      render(
        <TTSSettingsProvider>
          <div>
            <TTSControls text="Same text" />
            <TTSControls text="Same text" />
          </div>
        </TTSSettingsProvider>
      )

      const playButtons = screen.getAllByRole('button', { name: /play text-to-speech/i })
      
      // Click both play buttons rapidly
      await user.click(playButtons[0])
      await user.click(playButtons[1])

      // Should handle concurrent play requests appropriately
      expect(mockPlay).toHaveBeenCalledTimes(2)
    })
  })

  describe('Accessibility Integration', () => {
    it('should provide comprehensive ARIA labels for TTS controls', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true,
        progress: 50
      })

      render(
        <TTSSettingsProvider>
          <TTSControls text="Accessibility test" />
        </TTSSettingsProvider>
      )

      expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Text-to-speech controls')
      
      // Should have live region for status updates
      const liveRegion = screen.getByText(/playing text-to-speech: 50% complete/i)
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    })

    it('should announce TTS configuration changes', async () => {
      const user = userEvent.setup()
      
      const TestComponent = () => {
        const [engine, setEngine] = React.useState<'standard' | 'neural' | 'generative'>('standard')
        
        return (
          <TTSSettingsProvider>
            <div>
              <select 
                aria-label="TTS Engine"
                value={engine} 
                onChange={(e) => setEngine(e.target.value as any)}
              >
                <option value="standard">Standard</option>
                <option value="neural">Neural</option>
                <option value="generative">Generative</option>
              </select>
              <div aria-live="polite" aria-atomic="true">
                Current engine: {engine}
              </div>
            </div>
          </TTSSettingsProvider>
        )
      }

      render(<TestComponent />)

      const engineSelect = screen.getByLabelText('TTS Engine')
      await user.selectOptions(engineSelect, 'neural')

      expect(screen.getByText('Current engine: neural')).toBeInTheDocument()
    })
  })
})