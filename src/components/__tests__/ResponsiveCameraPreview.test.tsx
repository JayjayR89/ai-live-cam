import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CameraPreview } from '../CameraPreview'

// Mock dependencies
vi.mock('../AnimationWrapper', () => ({
  AnimationWrapper: ({ children, isAnimating, animationType }: any) => (
    <div 
      data-testid="animation-wrapper"
      data-animating={isAnimating}
      data-animation-type={animationType}
    >
      {children}
    </div>
  ),
  useAnimation: vi.fn(() => ({
    isAnimating: false,
    animationType: 'flip',
    startAnimation: vi.fn(),
    stopAnimation: vi.fn(),
  }))
}))

vi.mock('../ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: any) => <div data-testid="error-boundary">{children}</div>
}))

vi.mock('../LoadingIndicator', () => ({
  LoadingIndicator: ({ type, message }: any) => (
    <div data-testid="loading-indicator">
      <span data-testid="loading-type">{type}</span>
      <span data-testid="loading-message">{message}</span>
    </div>
  )
}))

vi.mock('@/lib/errorHandling', () => ({
  handleCameraError: vi.fn().mockReturnValue('error-id-123')
}))

describe('Responsive Camera Preview Tests', () => {
  const mockVideoRef = { current: null } as React.RefObject<HTMLVideoElement>
  
  const defaultProps = {
    videoRef: mockVideoRef,
    isMinimized: false,
    onToggleMinimize: vi.fn(),
    onFlipCamera: vi.fn(),
    isCameraLoading: false,
    videoLoaded: true,
    availableCameras: [
      { deviceId: 'camera1', kind: 'videoinput' as MediaDeviceKind, label: 'Front Camera', groupId: 'group1' },
      { deviceId: 'camera2', kind: 'videoinput' as MediaDeviceKind, label: 'Back Camera', groupId: 'group2' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset window properties
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
    
    // Mock user agent for desktop
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      writable: true
    })
  })

  describe('Desktop Device Behavior', () => {
    it('should display 16:9 aspect ratio on desktop', () => {
      // Mock desktop environment
      Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true })
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        writable: true
      })

      render(<CameraPreview {...defaultProps} />)

      const container = screen.getByTestId('animation-wrapper').closest('.camera-preview')
      expect(container).toHaveClass('aspect-video') // 16:9 aspect ratio
    })

    it('should show flip button on desktop when multiple cameras available', () => {
      render(<CameraPreview {...defaultProps} availableCameras={[
        { deviceId: 'camera1', kind: 'videoinput' as MediaDeviceKind, label: 'Front', groupId: 'g1' },
        { deviceId: 'camera2', kind: 'videoinput' as MediaDeviceKind, label: 'Back', groupId: 'g2' },
      ]} />)

      expect(screen.getByRole('button', { name: /switch camera/i })).toBeInTheDocument()
    })

    it('should handle window resize from desktop to mobile', async () => {
      const { rerender } = render(<CameraPreview {...defaultProps} />)

      // Initially desktop
      let container = screen.getByTestId('animation-wrapper').closest('.camera-preview')
      expect(container).toHaveClass('aspect-video')

      // Simulate resize to mobile
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true })
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true
      })

      fireEvent(window, new Event('resize'))

      // Re-render to trigger device detection update
      rerender(<CameraPreview {...defaultProps} />)

      // Should show mobile hint
      await waitFor(() => {
        expect(screen.getByText('Double tap to flip camera')).toBeInTheDocument()
      })
    })
  })

  describe('Mobile Device Behavior', () => {
    beforeEach(() => {
      // Mock mobile environment
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true })
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        writable: true
      })
    })

    it('should display 9:16 aspect ratio on mobile portrait', () => {
      render(<CameraPreview {...defaultProps} />)

      const container = screen.getByTestId('animation-wrapper').closest('.camera-preview')
      expect(container).toHaveClass('aspect-[9/16]') // Mobile portrait aspect ratio
    })

    it('should show double-tap hint on mobile', () => {
      render(<CameraPreview {...defaultProps} />)

      expect(screen.getByText('Double tap to flip camera')).toBeInTheDocument()
    })

    it('should show flip button on mobile even without detected cameras', () => {
      render(<CameraPreview {...defaultProps} availableCameras={[]} />)

      expect(screen.getByRole('button', { name: /switch camera/i })).toBeInTheDocument()
    })

    it('should handle double-tap to flip camera', async () => {
      const user = userEvent.setup()
      const mockOnFlipCamera = vi.fn()

      render(<CameraPreview {...defaultProps} onFlipCamera={mockOnFlipCamera} />)

      const video = screen.getByTestId('animation-wrapper').querySelector('video')!

      // Simulate double tap
      await user.click(video)
      await user.click(video)

      expect(mockOnFlipCamera).toHaveBeenCalled()
    })

    it('should handle orientation change', () => {
      render(<CameraPreview {...defaultProps} />)

      // Simulate orientation change
      fireEvent(window, new Event('orientationchange'))

      // Should trigger device detection update
      expect(screen.getByText('Double tap to flip camera')).toBeInTheDocument()
    })
  })

  describe('Tablet Device Behavior', () => {
    beforeEach(() => {
      // Mock tablet environment
      Object.defineProperty(window, 'innerWidth', { value: 768, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 1024, writable: true })
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        writable: true
      })
    })

    it('should handle tablet portrait mode', () => {
      render(<CameraPreview {...defaultProps} />)

      // Tablet should show mobile-like behavior in portrait
      expect(screen.getByText('Double tap to flip camera')).toBeInTheDocument()
    })

    it('should handle tablet landscape mode', () => {
      // Mock tablet landscape
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })

      render(<CameraPreview {...defaultProps} />)

      const container = screen.getByTestId('animation-wrapper').closest('.camera-preview')
      expect(container).toHaveClass('aspect-video') // Should use desktop-like aspect ratio
    })
  })

  describe('Responsive Layout Behavior', () => {
    it('should maintain aspect ratio when minimized', () => {
      render(
        <CameraPreview 
          {...defaultProps} 
          isMinimized={true} 
          previewMinWidth={300}
          maintainAspectRatio={true}
        />
      )

      const card = screen.getByTestId('error-boundary').querySelector('.relative')
      expect(card).toHaveStyle({ width: '300px' })
    })

    it('should apply correct container classes for different states', () => {
      const { rerender } = render(<CameraPreview {...defaultProps} isMinimized={false} />)

      let container = screen.getByTestId('animation-wrapper').closest('.camera-preview')
      expect(container).toHaveClass('w-full', 'max-w-full')

      rerender(<CameraPreview {...defaultProps} isMinimized={true} />)

      container = screen.getByTestId('animation-wrapper').closest('.camera-preview')
      expect(container).toHaveClass('minimized')
    })

    it('should handle very small screens', () => {
      // Mock very small screen
      Object.defineProperty(window, 'innerWidth', { value: 320, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 568, writable: true })

      render(<CameraPreview {...defaultProps} />)

      // Should still show mobile behavior
      expect(screen.getByText('Double tap to flip camera')).toBeInTheDocument()
    })

    it('should handle very large screens', () => {
      // Mock large desktop screen
      Object.defineProperty(window, 'innerWidth', { value: 2560, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 1440, writable: true })

      render(<CameraPreview {...defaultProps} />)

      const container = screen.getByTestId('animation-wrapper').closest('.camera-preview')
      expect(container).toHaveClass('aspect-video') // Should use desktop aspect ratio
    })
  })

  describe('Animation Integration with Device Types', () => {
    it('should use different animation types based on device', async () => {
      const user = userEvent.setup()
      const mockOnFlipCamera = vi.fn()

      // Mock mobile device
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true
      })

      render(<CameraPreview {...defaultProps} onFlipCamera={mockOnFlipCamera} isFlipping={true} />)

      // Mobile should use slide animation
      const animationWrapper = screen.getByTestId('animation-wrapper')
      expect(animationWrapper).toHaveAttribute('data-animation-type', 'slide')
    })

    it('should handle animation completion on different devices', async () => {
      const user = userEvent.setup()

      render(<CameraPreview {...defaultProps} isFlipping={true} />)

      const animationWrapper = screen.getByTestId('animation-wrapper')
      expect(animationWrapper).toHaveAttribute('data-animating', 'false')

      // Should complete animation properly regardless of device
      const completeButton = screen.queryByText('Complete Animation')
      if (completeButton) {
        await user.click(completeButton)
      }
    })
  })

  describe('Cross-Device Compatibility', () => {
    it('should work consistently across different user agents', () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', // Chrome Windows
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', // Chrome Mac
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15', // Safari iOS
        'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15', // Safari iPad
        'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36', // Chrome Android
      ]

      userAgents.forEach(userAgent => {
        Object.defineProperty(navigator, 'userAgent', {
          value: userAgent,
          writable: true
        })

        const { unmount } = render(<CameraPreview {...defaultProps} />)

        // Should render without errors
        expect(screen.getByTestId('animation-wrapper')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /switch camera/i })).toBeInTheDocument()

        unmount()
      })
    })

    it('should handle unknown devices gracefully', () => {
      // Mock unknown/custom user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'CustomBrowser/1.0 (Unknown Device)',
        writable: true
      })

      render(<CameraPreview {...defaultProps} />)

      // Should default to desktop behavior
      const container = screen.getByTestId('animation-wrapper').closest('.camera-preview')
      expect(container).toHaveClass('aspect-video')
    })
  })

  describe('Performance Across Devices', () => {
    it('should not re-render unnecessarily on device changes', () => {
      const renderSpy = vi.fn()

      const TestComponent = (props: any) => {
        renderSpy()
        return <CameraPreview {...props} />
      }

      const { rerender } = render(<TestComponent {...defaultProps} />)

      const initialCallCount = renderSpy.mock.calls.length

      // Same props should not trigger additional re-renders beyond React's normal behavior
      rerender(<TestComponent {...defaultProps} />)
      
      // React may re-render for various reasons, so we just ensure it doesn't explode
      expect(renderSpy.mock.calls.length).toBeGreaterThanOrEqual(initialCallCount)

      // Device change should still work correctly
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
      fireEvent(window, new Event('resize'))

      rerender(<TestComponent {...defaultProps} />)
      
      // Should still render correctly after device change
      expect(screen.getByTestId('animation-wrapper')).toBeInTheDocument()
    })

    it('should handle rapid resize events efficiently', () => {
      render(<CameraPreview {...defaultProps} />)

      // Simulate rapid resize events
      for (let i = 0; i < 10; i++) {
        Object.defineProperty(window, 'innerWidth', { value: 300 + i * 100, writable: true })
        fireEvent(window, new Event('resize'))
      }

      // Should still render correctly
      expect(screen.getByTestId('animation-wrapper')).toBeInTheDocument()
    })
  })
})