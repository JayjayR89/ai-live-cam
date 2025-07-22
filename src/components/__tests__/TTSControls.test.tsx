import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { TTSControls } from '../TTSControls'

// Mock dependencies
vi.mock('../AudioScrubBar', () => ({
  AudioScrubBar: ({ currentTime, duration, isPlaying, onSeek }: any) => (
    <div data-testid="audio-scrub-bar">
      <span>Time: {currentTime}/{duration}</span>
      <span>Playing: {isPlaying.toString()}</span>
      <button onClick={() => onSeek(50)}>Seek</button>
    </div>
  )
}))

vi.mock('@/hooks/useTTSAudio', () => ({
  useTTSAudio: vi.fn(() => ({
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    progress: 0,
    error: null,
    play: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
  }))
}))

vi.mock('@/contexts/TTSSettingsContext', () => ({
  useTTSSettings: vi.fn(() => ({
    ttsConfig: {
      engine: 'standard',
      voice: {
        language: 'en-US',
        name: 'Joanna',
        engine: 'neural',
        displayName: 'Joanna (US, Neural)'
      }
    }
  }))
}))

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}))

vi.mock('@/lib/errorHandling', () => ({
  handleTTSError: vi.fn().mockReturnValue('error-id-123')
}))

vi.mock('../ErrorBoundary', () => ({
  TTSErrorBoundary: ({ children }: any) => <div data-testid="error-boundary">{children}</div>
}))

vi.mock('../LoadingIndicator', () => ({
  LoadingIndicator: ({ type, message }: any) => (
    <div data-testid="loading-indicator">
      <span>Type: {type}</span>
      <span>Message: {message}</span>
    </div>
  )
}))

import { useTTSAudio } from '@/hooks/useTTSAudio'
import { useTTSSettings } from '@/contexts/TTSSettingsContext'
import { handleTTSError } from '@/lib/errorHandling'

const mockUseTTSAudio = useTTSAudio as any
const mockUseTTSSettings = useTTSSettings as any
const mockHandleTTSError = handleTTSError as any

describe('TTSControls', () => {
  const defaultProps = {
    text: 'Hello world, this is a test message.',
  }

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
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTTSAudio.mockReturnValue(mockTTSHook)
    mockUseTTSSettings.mockReturnValue({
      ttsConfig: {
        engine: 'standard',
        voice: {
          language: 'en-US',
          name: 'Joanna',
          engine: 'neural',
          displayName: 'Joanna (US, Neural)'
        }
      }
    })
  })

  describe('Rendering', () => {
    it('should render play and stop buttons', () => {
      render(<TTSControls {...defaultProps} />)
      
      expect(screen.getByRole('button', { name: /play text-to-speech/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /stop text-to-speech/i })).toBeInTheDocument()
    })

    it('should render with error boundary', () => {
      render(<TTSControls {...defaultProps} />)
      
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    })

    it('should render with custom className', () => {
      render(<TTSControls {...defaultProps} className="custom-class" />)
      
      const container = screen.getByRole('group')
      expect(container).toHaveClass('custom-class')
    })

    it('should render with different variants and sizes', () => {
      const { rerender } = render(
        <TTSControls {...defaultProps} variant="ghost" size="lg" />
      )
      
      const playButton = screen.getByRole('button', { name: /play/i })
      expect(playButton).toBeInTheDocument()
      
      rerender(<TTSControls {...defaultProps} variant="outline" size="sm" />)
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    })
  })

  describe('Play Functionality', () => {
    it('should call play when play button is clicked', async () => {
      const user = userEvent.setup()
      const mockPlay = vi.fn()
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        play: mockPlay
      })
      
      render(<TTSControls {...defaultProps} />)
      
      const playButton = screen.getByRole('button', { name: /play/i })
      await user.click(playButton)
      
      expect(mockPlay).toHaveBeenCalledWith(defaultProps.text, expect.any(Object))
    })

    it('should use custom config when provided', async () => {
      const user = userEvent.setup()
      const mockPlay = vi.fn()
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        play: mockPlay
      })
      
      const customConfig = {
        engine: 'generative' as const,
        voice: {
          language: 'en-GB',
          name: 'Amy',
          engine: 'generative' as const,
          displayName: 'Amy (British, Generative)'
        }
      }
      
      render(<TTSControls {...defaultProps} config={customConfig} />)
      
      const playButton = screen.getByRole('button', { name: /play/i })
      await user.click(playButton)
      
      expect(mockPlay).toHaveBeenCalledWith(defaultProps.text, customConfig)
    })

    it('should call onPlayStart callback', async () => {
      const user = userEvent.setup()
      const mockOnPlayStart = vi.fn()
      
      render(<TTSControls {...defaultProps} onPlayStart={mockOnPlayStart} />)
      
      const playButton = screen.getByRole('button', { name: /play/i })
      await user.click(playButton)
      
      expect(mockOnPlayStart).toHaveBeenCalled()
    })

    it('should handle empty text', async () => {
      const user = userEvent.setup()
      const mockOnError = vi.fn()
      
      render(<TTSControls text="" onError={mockOnError} />)
      
      const playButton = screen.getByRole('button', { name: /play/i })
      await user.click(playButton)
      
      expect(mockHandleTTSError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          component: 'TTSControls',
          action: 'play_empty_text'
        })
      )
      expect(mockOnError).toHaveBeenCalledWith('No text available for TTS')
    })

    it('should handle play errors', async () => {
      const user = userEvent.setup()
      const mockPlay = vi.fn().mockRejectedValue(new Error('Play failed'))
      const mockOnError = vi.fn()
      
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        play: mockPlay
      })
      
      render(<TTSControls {...defaultProps} onError={mockOnError} />)
      
      const playButton = screen.getByRole('button', { name: /play/i })
      await user.click(playButton)
      
      await waitFor(() => {
        expect(mockHandleTTSError).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            component: 'TTSControls',
            action: 'play_audio'
          })
        )
        expect(mockOnError).toHaveBeenCalledWith('Play failed')
      })
    })
  })

  describe('Stop Functionality', () => {
    it('should call stop when stop button is clicked', async () => {
      const user = userEvent.setup()
      const mockStop = vi.fn()
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true,
        stop: mockStop
      })
      
      render(<TTSControls {...defaultProps} />)
      
      const stopButton = screen.getByRole('button', { name: /stop/i })
      await user.click(stopButton)
      
      expect(mockStop).toHaveBeenCalled()
    })

    it('should call onPlayEnd callback', async () => {
      const user = userEvent.setup()
      const mockOnPlayEnd = vi.fn()
      
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true
      })
      
      render(<TTSControls {...defaultProps} onPlayEnd={mockOnPlayEnd} />)
      
      const stopButton = screen.getByRole('button', { name: /stop/i })
      await user.click(stopButton)
      
      expect(mockOnPlayEnd).toHaveBeenCalled()
    })

    it('should handle stop errors', async () => {
      const user = userEvent.setup()
      const mockStop = vi.fn().mockImplementation(() => {
        throw new Error('Stop failed')
      })
      
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true,
        stop: mockStop
      })
      
      render(<TTSControls {...defaultProps} />)
      
      const stopButton = screen.getByRole('button', { name: /stop/i })
      await user.click(stopButton)
      
      expect(mockHandleTTSError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          component: 'TTSControls',
          action: 'stop_audio'
        })
      )
    })
  })

  describe('Loading States', () => {
    it('should show loading state when TTS is loading', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isLoading: true
      })
      
      render(<TTSControls {...defaultProps} />)
      
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
      expect(screen.getByText('Type: tts')).toBeInTheDocument()
      expect(screen.getByText('Message: Generating speech...')).toBeInTheDocument()
      
      const playButton = screen.getByRole('button', { name: /loading/i })
      expect(playButton).toBeDisabled()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should show loading icon in play button', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isLoading: true
      })
      
      render(<TTSControls {...defaultProps} />)
      
      const playButton = screen.getByRole('button', { name: /loading/i })
      expect(playButton).toHaveClass('cursor-not-allowed')
    })
  })

  describe('Playing States', () => {
    it('should disable play button when playing', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true
      })
      
      render(<TTSControls {...defaultProps} />)
      
      const playButton = screen.getByRole('button', { name: /play/i })
      expect(playButton).toBeDisabled()
    })

    it('should enable stop button when playing', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true
      })
      
      render(<TTSControls {...defaultProps} />)
      
      const stopButton = screen.getByRole('button', { name: /stop/i })
      expect(stopButton).not.toBeDisabled()
    })

    it('should call onPlayEnd when audio ends naturally', () => {
      const mockOnPlayEnd = vi.fn()
      
      const { rerender } = render(
        <TTSControls {...defaultProps} onPlayEnd={mockOnPlayEnd} />
      )
      
      // Simulate audio ending naturally
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: false,
        isLoading: false,
        currentTime: 0,
        duration: 100 // Has duration but not playing and currentTime is 0
      })
      
      rerender(<TTSControls {...defaultProps} onPlayEnd={mockOnPlayEnd} />)
      
      expect(mockOnPlayEnd).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should display error indicator when there is an error', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        error: 'TTS service unavailable'
      })
      
      render(<TTSControls {...defaultProps} />)
      
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Error: TTS service unavailable', { exact: false })).toBeInTheDocument()
    })

    it('should call onError callback when hook has error', () => {
      const mockOnError = vi.fn()
      
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        error: 'Network error'
      })
      
      render(<TTSControls {...defaultProps} onError={mockOnError} />)
      
      expect(mockOnError).toHaveBeenCalledWith('Network error')
    })

    it('should handle hook errors with error handler', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        error: 'Service error'
      })
      
      render(<TTSControls {...defaultProps} />)
      
      expect(mockHandleTTSError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          component: 'TTSControls',
          action: 'hook_error'
        })
      )
    })
  })

  describe('Audio Scrub Bar', () => {
    it('should show scrub bar when playing', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true,
        currentTime: 30,
        duration: 100
      })
      
      render(<TTSControls {...defaultProps} />)
      
      expect(screen.getByTestId('audio-scrub-bar')).toBeInTheDocument()
      expect(screen.getByText('Time: 30/100')).toBeInTheDocument()
      expect(screen.getByText('Playing: true')).toBeInTheDocument()
    })

    it('should show scrub bar when has duration', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: false,
        currentTime: 0,
        duration: 100
      })
      
      render(<TTSControls {...defaultProps} />)
      
      expect(screen.getByTestId('audio-scrub-bar')).toBeInTheDocument()
    })

    it('should hide scrub bar when showScrubBar is false', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true,
        duration: 100
      })
      
      render(<TTSControls {...defaultProps} showScrubBar={false} />)
      
      expect(screen.queryByTestId('audio-scrub-bar')).not.toBeInTheDocument()
    })

    it('should handle seeking from scrub bar', async () => {
      const user = userEvent.setup()
      const mockSeek = vi.fn()
      
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true,
        duration: 100,
        seek: mockSeek
      })
      
      render(<TTSControls {...defaultProps} />)
      
      const seekButton = screen.getByText('Seek')
      await user.click(seekButton)
      
      expect(mockSeek).toHaveBeenCalledWith(50)
    })

    it('should handle seek errors', async () => {
      const user = userEvent.setup()
      const mockSeek = vi.fn().mockImplementation(() => {
        throw new Error('Seek failed')
      })
      
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true,
        duration: 100,
        seek: mockSeek
      })
      
      render(<TTSControls {...defaultProps} />)
      
      const seekButton = screen.getByText('Seek')
      await user.click(seekButton)
      
      expect(mockHandleTTSError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          component: 'TTSControls',
          action: 'seek_audio',
          additionalData: { seekTime: 50 }
        })
      )
    })
  })

  describe('Disabled State', () => {
    it('should disable buttons when disabled prop is true', () => {
      render(<TTSControls {...defaultProps} disabled={true} />)
      
      const playButton = screen.getByRole('button', { name: /play/i })
      const stopButton = screen.getByRole('button', { name: /stop/i })
      
      expect(playButton).toBeDisabled()
      expect(stopButton).toBeDisabled()
    })

    it('should disable buttons when text is empty', () => {
      render(<TTSControls text="" />)
      
      const playButton = screen.getByRole('button', { name: /play/i })
      expect(playButton).toBeDisabled()
    })

    it('should disable buttons when text is only whitespace', () => {
      render(<TTSControls text="   \n\t   " />)
      
      const playButton = screen.getByRole('button', { name: /play/i })
      expect(playButton).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<TTSControls {...defaultProps} />)
      
      expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Text-to-speech controls')
      expect(screen.getByRole('button', { name: /play text-to-speech/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /stop text-to-speech/i })).toBeInTheDocument()
    })

    it('should provide live status updates', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isPlaying: true,
        progress: 50
      })
      
      render(<TTSControls {...defaultProps} />)
      
      const liveRegion = screen.getByText(/playing text-to-speech: 50% complete/i)
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    })

    it('should announce loading state', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        isLoading: true
      })
      
      render(<TTSControls {...defaultProps} />)
      
      expect(screen.getByText('Loading text-to-speech audio...')).toBeInTheDocument()
    })

    it('should announce errors', () => {
      mockUseTTSAudio.mockReturnValue({
        ...mockTTSHook,
        error: 'Service unavailable'
      })
      
      render(<TTSControls {...defaultProps} />)
      
      expect(screen.getByText('Text-to-speech error: Service unavailable')).toBeInTheDocument()
    })
  })

  describe('Performance Optimization', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = vi.fn()
      
      const TestComponent = (props: any) => {
        renderSpy()
        return <TTSControls {...props} />
      }
      
      const { rerender } = render(
        <TestComponent {...defaultProps} />
      )
      
      expect(renderSpy).toHaveBeenCalledTimes(1)
      
      // Same props should not trigger re-render
      rerender(
        <TestComponent {...defaultProps} />
      )
      
      expect(renderSpy).toHaveBeenCalledTimes(1)
      
      // Different text should trigger re-render
      rerender(
        <TestComponent {...defaultProps} text="Different text" />
      )
      
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })
  })
})