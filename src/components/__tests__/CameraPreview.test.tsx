import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CameraPreview } from '../CameraPreview'

// Mock dependencies
vi.mock('../AnimationWrapper', () => ({
  AnimationWrapper: ({ children, isAnimating, animationType, onAnimationComplete }: any) => (
    <div 
      data-testid="animation-wrapper"
      data-animating={isAnimating}
      data-animation-type={animationType}
    >
      {children}
      {isAnimating && (
        <button onClick={onAnimationComplete}>Complete Animation</button>
      )}
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
  ErrorBoundary: ({ children, fallback, onError }: any) => (
    <div data-testid="error-boundary">
      {children}
    </div>
  )
}))

vi.mock('../LoadingIndicator', () => ({
  LoadingIndicator: ({ type, message, subMessage }: any) => (
    <div data-testid="loading-indicator">
      <span>Type: {type}</span>
      <span>Message: {message}</span>
      <span>SubMessage: {subMessage}</span>
    </div>
  )
}))

vi.mock('@/lib/errorHandling', () => ({
  handleCameraError: vi.fn().mockReturnValue('error-id-123')
}))

import { useAnimation } from '../AnimationWrapper'
import { handleCameraError } from '@/lib/errorHandling'

const mockUseAnimation = useAnimation as any
const mockHandleCameraError = handleCameraError as any

describe('CameraPreview', () => {
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

  const mockAnimationHook = {
    isAnimating: false,
    animationType: 'flip' as const,
    startAnimation: vi.fn(),
    stopAnimation: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAnimation.mockReturnValue(mockAnimationHook)
    
    // Mock window properties
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
    
    // Mock user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      writable: true
    })
  })

  describe('Rendering', () => {
    it('should render camera preview with video element', () => {
      render(<CameraPreview {...defaultProps} />)
      
      expect(screen.getByRole('button', { name: /expand camera preview/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /switch camera/i })).toBeInTheDocument()
      expect(screen.getByTestId('animation-wrapper')).toBeInTheDocument()
    })

    it('should render with error boundary', () => {
      render(<CameraPreview {...defaultProps} />)
      
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    })

    it('should show minimize button when not minimized', () => {
      render(<CameraPreview {...defaultProps} isMinimized={false} />)
      
      const button = screen.getByRole('button', { name: /minimize camera preview/i })
      expect(button).toBeInTheDocument()
    })

    it('should show maximize button when minimized', () => {
      render(<CameraPreview {...defaultProps} isMinimized={true} />)
      
      const button = screen.getByRole('button', { name: /expand camera preview/i })
      expect(button).toBeInTheDocument()
    })
  })

  describe('Device Detection', () => {
    it('should detect desktop device', () => {
      // Mock desktop environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        writable: true
      })
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 768, writable: true })
      
      render(<CameraPreview {...defaultProps} />)
      
      // In development mode, should show device info
      if (process.env.NODE_ENV === 'development') {
        expect(screen.getByText('desktop | 16:9')).toBeInTheDocument()
      }
    })

    it('should detect mobile device', () => {
      // Mock mobile environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        writable: true
      })
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true })
      
      render(<CameraPreview {...defaultProps} />)
      
      // Should show double-tap hint for mobile
      expect(screen.getByText('Double tap to flip camera')).toBeInTheDocument()
    })

    it('should handle window resize for device detection', () => {
      render(<CameraPreview {...defaultProps} />)
      
      // Simulate window resize
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true })
      
      fireEvent(window, new Event('resize'))
      
      // Should update device detection
      expect(screen.getByText('Double tap to flip camera')).toBeInTheDocument()
    })

    it('should handle orientation change', () => {
      render(<CameraPreview {...defaultProps} />)
      
      // Simulate orientation change
      fireEvent(window, new Event('orientationchange'))
      
      // Should trigger device detection update
      expect(mockUseAnimation).toHaveBeenCalled()
    })
  })

  describe('Camera Flip Functionality', () => {
    it('should call onFlipCamera when flip button is clicked', async () => {
      const user = userEvent.setup()
      const mockOnFlipCamera = vi.fn()
      
      render(<CameraPreview {...defaultProps} onFlipCamera={mockOnFlipCamera} />)
      
      const flipButton = screen.getByRole('button', { name: /switch camera/i })
      await user.click(flipButton)
      
      expect(mockOnFlipCamera).toHaveBeenCalled()
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

    it('should not flip camera when loading', async () => {
      const user = userEvent.setup()
      const mockOnFlipCamera = vi.fn()
      
      render(
        <CameraPreview 
          {...defaultProps} 
          onFlipCamera={mockOnFlipCamera}
          isCameraLoading={true}
        />
      )
      
      const flipButton = screen.getByRole('button', { name: /switch camera/i })
      await user.click(flipButton)
      
      expect(mockOnFlipCamera).not.toHaveBeenCalled()
    })

    it('should not flip camera when already flipping', async () => {
      const user = userEvent.setup()
      const mockOnFlipCamera = vi.fn()
      
      render(
        <CameraPreview 
          {...defaultProps} 
          onFlipCamera={mockOnFlipCamera}
          isFlipping={true}
        />
      )
      
      const flipButton = screen.getByRole('button', { name: /switch camera/i })
      await user.click(flipButton)
      
      expect(mockOnFlipCamera).not.toHaveBeenCalled()
    })

    it('should handle flip camera errors', async () => {
      const user = userEvent.setup()
      const mockOnFlipCamera = vi.fn().mockImplementation(() => {
        throw new Error('Camera flip failed')
      })
      
      render(<CameraPreview {...defaultProps} onFlipCamera={mockOnFlipCamera} />)
      
      const flipButton = screen.getByRole('button', { name: /switch camera/i })
      await user.click(flipButton)
      
      expect(mockHandleCameraError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          component: 'CameraPreview',
          action: 'flip_camera'
        })
      )
    })
  })

  describe('Loading States', () => {
    it('should show loading indicator when camera is loading', () => {
      render(<CameraPreview {...defaultProps} isCameraLoading={true} />)
      
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
      expect(screen.getByText('Message: Loading camera...')).toBeInTheDocument()
      expect(screen.getByText('SubMessage: Initializing camera feed')).toBeInTheDocument()
    })

    it('should show flipping indicator when camera is flipping', () => {
      render(<CameraPreview {...defaultProps} isFlipping={true} />)
      
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
      expect(screen.getByText('Message: Switching camera...')).toBeInTheDocument()
      expect(screen.getByText('SubMessage: Please wait while we switch cameras')).toBeInTheDocument()
    })

    it('should show progress indicator when flipping', () => {
      render(<CameraPreview {...defaultProps} isFlipping={true} />)
      
      // Should show progress bar for camera flip
      const progressBar = screen.getByText('Please wait while we switch cameras')
        .closest('div')?.querySelector('.animate-pulse')
      expect(progressBar).toBeInTheDocument()
    })
  })

  describe('Animation Integration', () => {
    it('should start animation when isFlipping becomes true', () => {
      const mockStartAnimation = vi.fn()
      mockUseAnimation.mockReturnValue({
        ...mockAnimationHook,
        startAnimation: mockStartAnimation
      })
      
      const { rerender } = render(<CameraPreview {...defaultProps} isFlipping={false} />)
      
      rerender(<CameraPreview {...defaultProps} isFlipping={true} />)
      
      expect(mockStartAnimation).toHaveBeenCalled()
    })

    it('should stop animation when isFlipping becomes false', () => {
      const mockStopAnimation = vi.fn()
      mockUseAnimation.mockReturnValue({
        ...mockAnimationHook,
        isAnimating: true,
        stopAnimation: mockStopAnimation
      })
      
      const { rerender } = render(<CameraPreview {...defaultProps} isFlipping={true} />)
      
      rerender(<CameraPreview {...defaultProps} isFlipping={false} />)
      
      expect(mockStopAnimation).toHaveBeenCalled()
    })

    it('should use different animation types based on device', () => {
      const mockStartAnimation = vi.fn()
      mockUseAnimation.mockReturnValue({
        ...mockAnimationHook,
        startAnimation: mockStartAnimation
      })
      
      // Mock mobile device
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true
      })
      
      render(<CameraPreview {...defaultProps} isFlipping={true} />)
      
      expect(mockStartAnimation).toHaveBeenCalledWith('slide')
    })
  })

  describe('Flip Button Visibility', () => {
    it('should show flip button when multiple cameras available', () => {
      render(<CameraPreview {...defaultProps} availableCameras={[
        { deviceId: 'camera1', kind: 'videoinput' as MediaDeviceKind, label: 'Front', groupId: 'g1' },
        { deviceId: 'camera2', kind: 'videoinput' as MediaDeviceKind, label: 'Back', groupId: 'g2' },
      ]} />)
      
      expect(screen.getByRole('button', { name: /switch camera/i })).toBeInTheDocument()
    })

    it('should show flip button on mobile even with no detected cameras', () => {
      // Mock mobile device
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true
      })
      
      render(<CameraPreview {...defaultProps} availableCameras={[]} />)
      
      expect(screen.getByRole('button', { name: /switch camera/i })).toBeInTheDocument()
    })

    it('should hide flip button when showFlipButton is false', () => {
      render(<CameraPreview {...defaultProps} showFlipButton={false} />)
      
      expect(screen.queryByRole('button', { name: /switch camera/i })).not.toBeInTheDocument()
    })

    it('should hide flip button when camera is loading', () => {
      render(<CameraPreview {...defaultProps} isCameraLoading={true} />)
      
      expect(screen.queryByRole('button', { name: /switch camera/i })).not.toBeInTheDocument()
    })
  })

  describe('Minimize/Maximize Functionality', () => {
    it('should call onToggleMinimize when minimize button is clicked', async () => {
      const user = userEvent.setup()
      const mockOnToggleMinimize = vi.fn()
      
      render(<CameraPreview {...defaultProps} onToggleMinimize={mockOnToggleMinimize} />)
      
      const minimizeButton = screen.getByRole('button', { name: /minimize camera preview/i })
      await user.click(minimizeButton)
      
      expect(mockOnToggleMinimize).toHaveBeenCalled()
    })

    it('should apply minimized styles when minimized', () => {
      render(<CameraPreview {...defaultProps} isMinimized={true} previewMinWidth={300} />)
      
      const card = screen.getByTestId('error-boundary').querySelector('.relative')
      expect(card).toHaveStyle({ width: '300px' })
    })

    it('should maintain aspect ratio when minimized', () => {
      render(
        <CameraPreview 
          {...defaultProps} 
          isMinimized={true} 
          previewMinWidth={400}
          maintainAspectRatio={true}
        />
      )
      
      const card = screen.getByTestId('error-boundary').querySelector('.relative')
      expect(card).toHaveStyle({ width: '400px' })
      // Height should be calculated based on aspect ratio
    })
  })

  describe('Video Display', () => {
    it('should show video with correct classes when loaded', () => {
      render(<CameraPreview {...defaultProps} videoLoaded={true} />)
      
      const video = screen.getByTestId('animation-wrapper').querySelector('video')
      expect(video).toHaveClass('opacity-100')
      expect(video).toHaveClass('object-contain') // Ensures no cropping
    })

    it('should hide video when not loaded', () => {
      render(<CameraPreview {...defaultProps} videoLoaded={false} />)
      
      const video = screen.getByTestId('animation-wrapper').querySelector('video')
      expect(video).toHaveClass('opacity-0')
    })

    it('should apply correct aspect ratio classes', () => {
      render(<CameraPreview {...defaultProps} />)
      
      const container = screen.getByTestId('animation-wrapper').closest('.camera-preview')
      expect(container).toHaveClass('aspect-video') // 16:9 for desktop
    })

    it('should handle video click for double-tap', async () => {
      const user = userEvent.setup()
      const mockOnFlipCamera = vi.fn()
      
      render(<CameraPreview {...defaultProps} onFlipCamera={mockOnFlipCamera} />)
      
      const video = screen.getByTestId('animation-wrapper').querySelector('video')!
      
      // Single click should not trigger flip
      await user.click(video)
      expect(mockOnFlipCamera).not.toHaveBeenCalled()
      
      // Double click should trigger flip
      await user.click(video)
      expect(mockOnFlipCamera).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle double-tap errors', async () => {
      const user = userEvent.setup()
      
      // Mock Date.now to cause an error in double-tap logic
      const originalDateNow = Date.now
      Date.now = vi.fn().mockImplementation(() => {
        throw new Error('Date error')
      })
      
      render(<CameraPreview {...defaultProps} />)
      
      const video = screen.getByTestId('animation-wrapper').querySelector('video')!
      await user.click(video)
      
      expect(mockHandleCameraError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          component: 'CameraPreview',
          action: 'double_tap_handler'
        })
      )
      
      Date.now = originalDateNow
    })
  })

  describe('Accessibility', () => {
    it('should have proper button labels', () => {
      render(<CameraPreview {...defaultProps} />)
      
      expect(screen.getByRole('button', { name: /minimize camera preview/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /switch camera.*double tap/i })).toBeInTheDocument()
    })

    it('should provide video interaction hints', () => {
      render(<CameraPreview {...defaultProps} />)
      
      const video = screen.getByTestId('animation-wrapper').querySelector('video')
      expect(video).toHaveClass('cursor-pointer')
    })
  })

  describe('Performance Optimization', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = vi.fn()
      
      const TestComponent = (props: any) => {
        renderSpy()
        return <CameraPreview {...props} />
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
      
      // Different isMinimized should trigger re-render
      rerender(
        <TestComponent {...defaultProps} isMinimized={true} />
      )
      
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('Responsive Design', () => {
    it('should apply correct container classes for different states', () => {
      const { rerender } = render(<CameraPreview {...defaultProps} isMinimized={false} />)
      
      let container = screen.getByTestId('animation-wrapper').closest('.camera-preview')
      expect(container).toHaveClass('w-full', 'max-w-full')
      
      rerender(<CameraPreview {...defaultProps} isMinimized={true} />)
      
      container = screen.getByTestId('animation-wrapper').closest('.camera-preview')
      expect(container).toHaveClass('minimized')
    })

    it('should handle different aspect ratios', () => {
      // Mock mobile portrait
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true
      })
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true })
      
      render(<CameraPreview {...defaultProps} />)
      
      const container = screen.getByTestId('animation-wrapper').closest('.camera-preview')
      expect(container).toHaveClass('aspect-[9/16]') // Mobile portrait
    })
  })
})