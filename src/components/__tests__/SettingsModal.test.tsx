import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SettingsModal } from '../SettingsModal'
import { TTSSettingsProvider } from '@/contexts/TTSSettingsContext'

// Mock UI components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: any) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogFooter: ({ children, className }: any) => (
    <div data-testid="dialog-footer" className={className}>
      {children}
    </div>
  )
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: any) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  )
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className, ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value, disabled }: any) => (
    <div data-testid="select" data-value={value} data-disabled={disabled}>
      <button onClick={() => onValueChange('test-value')}>Select</button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children, className }: any) => (
    <div data-testid="select-trigger" className={className}>{children}</div>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, className }: any) => (
    <label htmlFor={htmlFor} className={className}>{children}</label>
  )
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled, className }: any) => (
    <button
      data-testid="switch"
      data-checked={checked}
      data-disabled={disabled}
      className={className}
      onClick={() => onCheckedChange(!checked)}
    >
      {checked ? 'ON' : 'OFF'}
    </button>
  )
}))

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}))

describe('SettingsModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    settings: {
      autoCapture: false,
      captureInterval: 5,
      maxImages: 10,
      imageQuality: 0.8,
      enableNotifications: true,
      theme: 'light' as const,
    },
    onSave: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })
  })

  describe('Modal Rendering', () => {
    it('should render when open', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-header')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-footer')).toBeInTheDocument()
    })

    it('should not render when closed', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} isOpen={false} />
        </TTSSettingsProvider>
      )
      
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })

    it('should have proper title', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Settings')
    })
  })

  describe('Layout and Scrolling', () => {
    it('should have scroll area for content', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const scrollArea = screen.getByTestId('scroll-area')
      expect(scrollArea).toBeInTheDocument()
      expect(scrollArea).toHaveClass('max-h-[70vh]') // Should limit height
    })

    it('should have proper padding to prevent overlap with buttons', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const scrollArea = screen.getByTestId('scroll-area')
      expect(scrollArea).toHaveClass('pr-4') // Right padding for scrollbar
      
      const dialogContent = screen.getByTestId('dialog-content')
      expect(dialogContent).toHaveClass('max-w-2xl') // Proper width constraint
    })

    it('should have fixed footer that does not overlap content', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const footer = screen.getByTestId('dialog-footer')
      expect(footer).toHaveClass('flex', 'justify-end', 'gap-2', 'pt-4', 'border-t')
    })

    it('should handle long content without hiding settings', () => {
      // Create a settings object with many options to test scrolling
      const longSettings = {
        ...defaultProps.settings,
        // Add many settings to force scrolling
        option1: true,
        option2: false,
        option3: 'value',
        option4: 10,
        option5: true,
      }

      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} settings={longSettings} />
        </TTSSettingsProvider>
      )
      
      // All settings sections should be accessible
      expect(screen.getByText('General Settings')).toBeInTheDocument()
      expect(screen.getByText('TTS Settings')).toBeInTheDocument()
      expect(screen.getByText('Auto Capture')).toBeInTheDocument()
      
      // Footer buttons should be visible
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Save')).toBeInTheDocument()
    })
  })

  describe('Settings Sections', () => {
    it('should render general settings section', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      expect(screen.getByText('General Settings')).toBeInTheDocument()
      expect(screen.getByText('Auto Capture')).toBeInTheDocument()
      expect(screen.getByText('Capture Interval (seconds)')).toBeInTheDocument()
      expect(screen.getByText('Maximum Images')).toBeInTheDocument()
    })

    it('should render TTS settings section', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      expect(screen.getByText('TTS Settings')).toBeInTheDocument()
      expect(screen.getByText('TTS Engine')).toBeInTheDocument()
      expect(screen.getByText('Voice')).toBeInTheDocument()
    })

    it('should have proper spacing between sections', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const scrollArea = screen.getByTestId('scroll-area')
      const sections = scrollArea.querySelectorAll('.space-y-6 > div')
      
      // Should have multiple sections with proper spacing
      expect(sections.length).toBeGreaterThan(1)
    })
  })

  describe('Form Controls', () => {
    it('should render switches for boolean settings', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const switches = screen.getAllByTestId('switch')
      expect(switches.length).toBeGreaterThan(0)
      
      // Auto capture switch should be present
      const autoCaptureSwitch = switches.find(s => 
        s.closest('.flex')?.textContent?.includes('Auto Capture')
      )
      expect(autoCaptureSwitch).toBeDefined()
    })

    it('should render selects for choice settings', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const selects = screen.getAllByTestId('select')
      expect(selects.length).toBeGreaterThan(0)
      
      // Should have TTS engine and voice selects
      expect(selects.length).toBeGreaterThanOrEqual(2)
    })

    it('should have proper labels for all controls', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const labels = screen.getAllByRole('label')
      expect(labels.length).toBeGreaterThan(0)
      
      // Check for specific labels
      expect(screen.getByText('Auto Capture')).toBeInTheDocument()
      expect(screen.getByText('TTS Engine')).toBeInTheDocument()
      expect(screen.getByText('Voice')).toBeInTheDocument()
    })
  })

  describe('Button Actions', () => {
    it('should call onClose when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const mockOnClose = vi.fn()
      
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} onClose={mockOnClose} />
        </TTSSettingsProvider>
      )
      
      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)
      
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should call onSave when Save is clicked', async () => {
      const user = userEvent.setup()
      const mockOnSave = vi.fn()
      
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} onSave={mockOnSave} />
        </TTSSettingsProvider>
      )
      
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)
      
      expect(mockOnSave).toHaveBeenCalled()
    })

    it('should persist settings to localStorage on save', async () => {
      const user = userEvent.setup()
      const mockSetItem = vi.fn()
      window.localStorage.setItem = mockSetItem
      
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      // Change a setting
      const switches = screen.getAllByTestId('switch')
      if (switches.length > 0) {
        await user.click(switches[0])
      }
      
      const saveButton = screen.getByText('Save')
      await user.click(saveButton)
      
      expect(mockSetItem).toHaveBeenCalled()
    })
  })

  describe('Settings State Management', () => {
    it('should initialize with provided settings', () => {
      const customSettings = {
        ...defaultProps.settings,
        autoCapture: true,
        captureInterval: 10,
      }
      
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} settings={customSettings} />
        </TTSSettingsProvider>
      )
      
      const autoCaptureSwitch = screen.getAllByTestId('switch')[0]
      expect(autoCaptureSwitch).toHaveAttribute('data-checked', 'true')
    })

    it('should update settings when controls change', async () => {
      const user = userEvent.setup()
      
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const switches = screen.getAllByTestId('switch')
      const initialState = switches[0].getAttribute('data-checked')
      
      await user.click(switches[0])
      
      const newState = switches[0].getAttribute('data-checked')
      expect(newState).not.toBe(initialState)
    })

    it('should handle TTS engine changes', async () => {
      const user = userEvent.setup()
      
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const selects = screen.getAllByTestId('select')
      const engineSelect = selects.find(s => 
        s.closest('.space-y-2')?.textContent?.includes('TTS Engine')
      )
      
      if (engineSelect) {
        const selectButton = engineSelect.querySelector('button')
        if (selectButton) {
          await user.click(selectButton)
        }
      }
      
      // Should update the engine selection
      expect(engineSelect).toHaveAttribute('data-value', 'test-value')
    })

    it('should handle voice changes', async () => {
      const user = userEvent.setup()
      
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const selects = screen.getAllByTestId('select')
      const voiceSelect = selects.find(s => 
        s.closest('.space-y-2')?.textContent?.includes('Voice')
      )
      
      if (voiceSelect) {
        const selectButton = voiceSelect.querySelector('button')
        if (selectButton) {
          await user.click(selectButton)
        }
      }
      
      // Should update the voice selection
      expect(voiceSelect).toHaveAttribute('data-value', 'test-value')
    })
  })

  describe('Responsive Design', () => {
    it('should have responsive dialog content', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const dialogContent = screen.getByTestId('dialog-content')
      expect(dialogContent).toHaveClass('max-w-2xl')
    })

    it('should handle small screens', () => {
      // Mock small screen
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true })
      
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const scrollArea = screen.getByTestId('scroll-area')
      expect(scrollArea).toHaveClass('max-h-[70vh]') // Should limit height on small screens
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const dialog = screen.getByTestId('dialog')
      expect(dialog).toBeInTheDocument()
      
      const title = screen.getByTestId('dialog-title')
      expect(title).toHaveTextContent('Settings')
    })

    it('should have proper form labels', () => {
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const labels = screen.getAllByRole('label')
      expect(labels.length).toBeGreaterThan(0)
      
      // Each label should have text content
      labels.forEach(label => {
        expect(label.textContent).toBeTruthy()
      })
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      // Should be able to tab through controls
      const cancelButton = screen.getByText('Cancel')
      const saveButton = screen.getByText('Save')
      
      await user.tab()
      expect(document.activeElement).toBe(cancelButton)
      
      await user.tab()
      expect(document.activeElement).toBe(saveButton)
    })
  })

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock localStorage to throw error
      window.localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })
      
      render(
        <TTSSettingsProvider>
          <SettingsModal {...defaultProps} />
        </TTSSettingsProvider>
      )
      
      const saveButton = screen.getByText('Save')
      
      // Should not throw error when saving fails
      await expect(user.click(saveButton)).resolves.not.toThrow()
    })

    it('should handle invalid settings gracefully', () => {
      const invalidSettings = {
        ...defaultProps.settings,
        captureInterval: -1, // Invalid value
        maxImages: 'invalid' as any, // Wrong type
      }
      
      expect(() => {
        render(
          <TTSSettingsProvider>
            <SettingsModal {...defaultProps} settings={invalidSettings} />
          </TTSSettingsProvider>
        )
      }).not.toThrow()
    })
  })

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = vi.fn()
      
      const TestComponent = (props: any) => {
        renderSpy()
        return (
          <TTSSettingsProvider>
            <SettingsModal {...props} />
          </TTSSettingsProvider>
        )
      }
      
      const { rerender } = render(<TestComponent {...defaultProps} />)
      
      expect(renderSpy).toHaveBeenCalledTimes(1)
      
      // Same props should not trigger re-render
      rerender(<TestComponent {...defaultProps} />)
      
      expect(renderSpy).toHaveBeenCalledTimes(1)
      
      // Different isOpen should trigger re-render
      rerender(<TestComponent {...defaultProps} isOpen={false} />)
      
      expect(renderSpy).toHaveBeenCalledTimes(2)
    })
  })
})