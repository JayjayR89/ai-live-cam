import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AnimationWrapper, useAnimation, shouldDisableAnimations, detectLowPerformanceDevice } from '../AnimationWrapper';

// Mock matchMedia for testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock navigator properties for testing
Object.defineProperty(navigator, 'hardwareConcurrency', {
  writable: true,
  value: 4,
});

describe('AnimationWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders children correctly', () => {
    render(
      <AnimationWrapper isAnimating={false}>
        <div data-testid="test-child">Test Content</div>
      </AnimationWrapper>
    );
    
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  test('applies animation class when animating', () => {
    const { container } = render(
      <AnimationWrapper isAnimating={true} animationType="flip">
        <div>Test Content</div>
      </AnimationWrapper>
    );
    
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('animate-camera-flip');
  });

  test('respects reduced motion preference', () => {
    // Mock reduced motion preference
    (window.matchMedia as jest.Mock).mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { container } = render(
      <AnimationWrapper isAnimating={true} animationType="flip">
        <div>Test Content</div>
      </AnimationWrapper>
    );
    
    // Should use simple transition instead of complex animation
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('transition-opacity');
  });

  test('calls onAnimationComplete callback', (done) => {
    const mockCallback = jest.fn(() => {
      expect(mockCallback).toHaveBeenCalled();
      done();
    });

    render(
      <AnimationWrapper 
        isAnimating={true} 
        animationType="fade" 
        duration={100}
        onAnimationComplete={mockCallback}
      >
        <div>Test Content</div>
      </AnimationWrapper>
    );
  });
});

describe('useAnimation hook', () => {
  test('manages animation state correctly', () => {
    let hookResult: any;
    
    function TestComponent() {
      hookResult = useAnimation('flip');
      return <div>Test</div>;
    }

    render(<TestComponent />);
    
    expect(hookResult.isAnimating).toBe(false);
    expect(hookResult.animationType).toBe('flip');
    
    act(() => {
      hookResult.startAnimation('fade');
    });
    
    expect(hookResult.isAnimating).toBe(true);
    expect(hookResult.animationType).toBe('fade');
    
    act(() => {
      hookResult.stopAnimation();
    });
    
    expect(hookResult.isAnimating).toBe(false);
  });
});

describe('Utility functions', () => {
  test('shouldDisableAnimations detects reduced motion preference', () => {
    // Mock no reduced motion preference
    (window.matchMedia as jest.Mock).mockImplementation(() => ({
      matches: false,
    }));
    
    expect(shouldDisableAnimations()).toBe(false);
    
    // Mock reduced motion preference
    (window.matchMedia as jest.Mock).mockImplementation(() => ({
      matches: true,
    }));
    
    expect(shouldDisableAnimations()).toBe(true);
  });

  test('detectLowPerformanceDevice identifies low-end devices', () => {
    // Mock high-performance device
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      value: 8,
      writable: true,
    });
    
    expect(detectLowPerformanceDevice()).toBe(false);
    
    // Mock low-performance device
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      value: 1,
      writable: true,
    });
    
    expect(detectLowPerformanceDevice()).toBe(true);
  });
});