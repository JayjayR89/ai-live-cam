import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AudioScrubBar } from '../AudioScrubBar'

// Mock the Slider component
vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, max, min, step, className, ...props }: any) => (
    <div
      data-testid="slider"
      className={className}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value[0]}
      {...props}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => onValueChange([parseFloat(e.target.value)])}
        data-testid="slider-input"
      />
    </div>
  )
}))

describe('AudioScrubBar', () => {
  const defaultProps = {
    currentTime: 30,
    duration: 120,
    isPlaying: true,
    onSeek: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render with default props', () => {
      render(<AudioScrubBar {...defaultProps} />)
      
      expect(screen.getByText('0:30')).toBeInTheDocument()
      expect(screen.getByText('2:00')).toBeInTheDocument()
      expect(screen.getByTestId('slider')).toBeInTheDocument()
    })

    it('should render with custom className', () => {
      render(<AudioScrubBar {...defaultProps} className="custom-class" />)
      
      const container = screen.getByRole('group')
      expect(container).toHaveClass('custom-class')
    })

    it('should show correct opacity based on playing state', () => {
      const { rerender } = render(<AudioScrubBar {...defaultProps} isPlaying={true} />)
      
      let container = screen.getByRole('group')
      expect(container).toHaveClass('opacity-100')
      
      rerender(<AudioScrubBar {...defaultProps} isPlaying={false} />)
      
      container = screen.getByRole('group')
      expect(container).toHaveClass('opacity-75')
    })
  })

  describe('Time Formatting', () => {
    it('should format time correctly for various durations', () => {
      const testCases = [
        { time: 0, expected: '0:00' },
        { time: 5, expected: '0:05' },
        { time: 30, expected: '0:30' },
        { time: 60, expected: '1:00' },
        { time: 65, expected: '1:05' },
        { time: 125, expected: '2:05' },
        { time: 3661, expected: '61:01' }, // Over an hour
      ]

      testCases.forEach(({ time, expected }) => {
        const { rerender } = render(
          <AudioScrubBar
            {...defaultProps}
            currentTime={time}
            duration={time + 10}
          />
        )
        
        expect(screen.getByText(expected)).toBeInTheDocument()
        
        rerender(<div />)
      })
    })

    it('should handle invalid time values', () => {
      const testCases = [
        { time: -10, expected: '0:00' },
        { time: Infinity, expected: '0:00' },
        { time: NaN, expected: '0:00' },
      ]

      testCases.forEach(({ time, expected }) => {
        const { rerender } = render(
          <AudioScrubBar
            {...defaultProps}
            currentTime={time}
            duration={120}
          />
        )
        
        expect(screen.getByText(expected)).toBeInTheDocument()
        
        rerender(<div />)
      })
    })
  })

  describe('Progress Calculation', () => {
    it('should calculate progress percentage correctly', () => {
      render(<AudioScrubBar {...defaultProps} currentTime={30} duration={120} />)
      
      const slider = screen.getByTestId('slider')
      expect(slider).toHaveAttribute('aria-valuenow', '25') // 30/120 * 100 = 25%
    })

    it('should handle zero duration', () => {
      render(<AudioScrubBar {...defaultProps} currentTime={30} duration={0} />)
      
      const slider = screen.getByTestId('slider')
      expect(slider).toHaveAttribute('aria-valuenow', '0')
    })

    it('should clamp progress to 0-100 range', () => {
      // Test progress over 100%
      render(<AudioScrubBar {...defaultProps} currentTime={150} duration={120} />)
      
      let slider = screen.getByTestId('slider')
      expect(slider).toHaveAttribute('aria-valuenow', '100')

      // Test negative progress
      const { rerender } = render(<AudioScrubBar {...defaultProps} currentTime={-10} duration={120} />)
      
      slider = screen.getByTestId('slider')
      expect(slider).toHaveAttribute('aria-valuenow', '0')
    })
  })

  describe('Seeking Functionality', () => {
    it('should call onSeek when slider value changes', async () => {
      const user = userEvent.setup()
      const mockOnSeek = vi.fn()
      
      render(<AudioScrubBar {...defaultProps} onSeek={mockOnSeek} />)
      
      const sliderInput = screen.getByTestId('slider-input')
      
      await user.clear(sliderInput)
      await user.type(sliderInput, '50')
      
      expect(mockOnSeek).toHaveBeenCalledWith(60) // 50% of 120 seconds = 60 seconds
    })

    it('should calculate seek time correctly for different durations', async () => {
      const user = userEvent.setup()
      const mockOnSeek = vi.fn()
      
      render(
        <AudioScrubBar
          {...defaultProps}
          duration={200}
          onSeek={mockOnSeek}
        />
      )
      
      const sliderInput = screen.getByTestId('slider-input')
      
      await user.clear(sliderInput)
      await user.type(sliderInput, '25')
      
      expect(mockOnSeek).toHaveBeenCalledWith(50) // 25% of 200 seconds = 50 seconds
    })

    it('should handle seeking with zero duration', async () => {
      const user = userEvent.setup()
      const mockOnSeek = vi.fn()
      
      render(
        <AudioScrubBar
          {...defaultProps}
          duration={0}
          onSeek={mockOnSeek}
        />
      )
      
      const sliderInput = screen.getByTestId('slider-input')
      
      await user.clear(sliderInput)
      await user.type(sliderInput, '50')
      
      expect(mockOnSeek).toHaveBeenCalledWith(0) // 50% of 0 seconds = 0 seconds
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<AudioScrubBar {...defaultProps} />)
      
      expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Audio progress and controls')
      
      const slider = screen.getByTestId('slider')
      expect(slider).toHaveAttribute('aria-label', 'Audio progress: 25% complete')
      expect(slider).toHaveAttribute('aria-valuetext', '0:30 of 2:00')
    })

    it('should have proper time labels', () => {
      render(<AudioScrubBar {...defaultProps} />)
      
      const currentTimeElement = screen.getByText('0:30').closest('div')
      const durationElement = screen.getByText('2:00').closest('div')
      
      expect(currentTimeElement).toHaveAttribute('aria-label', 'Current time: 0:30')
      expect(durationElement).toHaveAttribute('aria-label', 'Total duration: 2:00')
    })

    it('should provide live status updates', () => {
      render(<AudioScrubBar {...defaultProps} isPlaying={true} />)
      
      const liveRegion = screen.getByText('Playing: 0:30 of 2:00')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    })

    it('should update live status when paused', () => {
      render(<AudioScrubBar {...defaultProps} isPlaying={false} />)
      
      const liveRegion = screen.getByText('Paused: 0:30 of 2:00')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('Performance Optimization', () => {
    it('should not re-render for small time changes', () => {
      const renderSpy = vi.fn()
      
      const TestComponent = (props: any) => {
        renderSpy()
        return <AudioScrubBar {...props} />
      }
      
      const { rerender } = render(
        <TestComponent {...defaultProps} currentTime={30.0} />
      )
      
      expect(renderSpy).toHaveBeenCalledTimes(1)
      
      // Small time change (< 0.1s) should not trigger re-render
      rerender(
        <TestComponent {...defaultProps} currentTime={30.05} />
      )
      
      expect(renderSpy).toHaveBeenCalledTimes(1)
      
      // Significant time change should trigger re-render
      rerender(
        <TestComponent {...defaultProps} currentTime={31.0} />
      )
      
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('should re-render when playing state changes', () => {
      const renderSpy = vi.fn()
      
      const TestComponent = (props: any) => {
        renderSpy()
        return <AudioScrubBar {...props} />
      }
      
      const { rerender } = render(
        <TestComponent {...defaultProps} isPlaying={true} />
      )
      
      expect(renderSpy).toHaveBeenCalledTimes(1)
      
      rerender(
        <TestComponent {...defaultProps} isPlaying={false} />
      )
      
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long durations', () => {
      render(
        <AudioScrubBar
          {...defaultProps}
          currentTime={3661}
          duration={7200}
        />
      )
      
      expect(screen.getByText('61:01')).toBeInTheDocument()
      expect(screen.getByText('120:00')).toBeInTheDocument()
    })

    it('should handle very short durations', () => {
      render(
        <AudioScrubBar
          {...defaultProps}
          currentTime={0.5}
          duration={1.0}
        />
      )
      
      expect(screen.getByText('0:00')).toBeInTheDocument() // Rounds down
      expect(screen.getByText('0:01')).toBeInTheDocument()
    })

    it('should handle currentTime exceeding duration', () => {
      render(
        <AudioScrubBar
          {...defaultProps}
          currentTime={150}
          duration={120}
        />
      )
      
      const slider = screen.getByTestId('slider')
      expect(slider).toHaveAttribute('aria-valuenow', '100') // Clamped to 100%
    })
  })

  describe('Animation Classes', () => {
    it('should apply pulse animation when playing', () => {
      render(<AudioScrubBar {...defaultProps} isPlaying={true} />)
      
      const slider = screen.getByTestId('slider')
      expect(slider).toHaveClass('animate-pulse-subtle')
    })

    it('should not apply pulse animation when paused', () => {
      render(<AudioScrubBar {...defaultProps} isPlaying={false} />)
      
      const slider = screen.getByTestId('slider')
      expect(slider).not.toHaveClass('animate-pulse-subtle')
    })
  })

  describe('Responsive Behavior', () => {
    it('should maintain minimum widths for time displays', () => {
      render(<AudioScrubBar {...defaultProps} />)
      
      const currentTimeElement = screen.getByText('0:30').closest('div')
      const durationElement = screen.getByText('2:00').closest('div')
      
      expect(currentTimeElement).toHaveClass('min-w-[2.5rem]')
      expect(durationElement).toHaveClass('min-w-[2.5rem]')
    })

    it('should have flexible slider container', () => {
      render(<AudioScrubBar {...defaultProps} />)
      
      const sliderContainer = screen.getByTestId('slider').closest('.flex-1')
      expect(sliderContainer).toHaveClass('flex-1', 'min-w-0')
    })
  })
})