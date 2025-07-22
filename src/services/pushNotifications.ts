interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
  data?: any;
  timestamp?: number;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;
  
  private constructor() {}
  
  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }
  
  // Check if notifications are supported
  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }
  
  // Get current permission status
  getPermissionStatus(): NotificationPermission {
    const permission = Notification.permission;
    return {
      granted: permission === 'granted',
      denied: permission === 'denied',
      default: permission === 'default'
    };
  }
  
  // Request notification permission
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('Notifications not supported');
      return false;
    }
    
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }
  
  // Initialize service worker for notifications
  async initialize(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }
    
    try {
      // Register service worker if not already registered
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          this.registration = registration;
        }
      }
      
      // Request permission
      const hasPermission = await this.requestPermission();
      return hasPermission;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      return false;
    }
  }
  
  // Send a local notification
  async sendNotification(options: PushNotificationOptions): Promise<void> {
    const { granted } = this.getPermissionStatus();
    
    if (!granted) {
      console.warn('Notification permission not granted');
      return;
    }
    
    try {
      // Use service worker notification if available, fallback to regular notification
      if (this.registration) {
        await this.registration.showNotification(options.title, {
          body: options.body,
          icon: options.icon || '/favicon.ico',
          badge: options.badge || '/favicon.ico',
          image: options.image,
          tag: options.tag || 'ai-live-cam',
          requireInteraction: options.requireInteraction || false,
          actions: options.actions || [],
          data: {
            ...options.data,
            timestamp: options.timestamp || Date.now(),
            url: window.location.origin
          },
          vibrate: [200, 100, 200], // Mobile vibration pattern
          timestamp: options.timestamp || Date.now()
        });
      } else {
        // Fallback to regular notification
        new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/favicon.ico',
          tag: options.tag || 'ai-live-cam',
          requireInteraction: options.requireInteraction || false,
          data: options.data
        });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }
  
  // Predefined notification types for the app
  async notifyBatchComplete(batchCount: number, totalImages: number): Promise<void> {
    await this.sendNotification({
      title: '📸 AI Batch Complete!',
      body: `Processed ${batchCount} batches with ${totalImages} images. Tap to view results.`,
      icon: '/favicon.ico',
      tag: 'batch-complete',
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: '👁️ View Gallery',
          icon: '/favicon.ico'
        },
        {
          action: 'dismiss',
          title: '✕ Dismiss',
          icon: '/favicon.ico'
        }
      ],
      data: { type: 'batch-complete', batchCount, totalImages }
    });
  }
  
  async notifyAIAnalysisComplete(imageCount: number, processingTime: number): Promise<void> {
    await this.sendNotification({
      title: '🤖 AI Analysis Complete!',
      body: `Analyzed ${imageCount} image${imageCount > 1 ? 's' : ''} in ${Math.round(processingTime / 1000)}s. Results ready!`,
      icon: '/favicon.ico',
      tag: 'ai-complete',
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: '📋 View Results',
          icon: '/favicon.ico'
        },
        {
          action: 'speak',
          title: '🔊 Listen',
          icon: '/favicon.ico'
        }
      ],
      data: { type: 'ai-complete', imageCount, processingTime }
    });
  }
  
  async notifyObjectDetected(objects: string[], confidence: number): Promise<void> {
    const objectList = objects.slice(0, 3).join(', ');
    const extraCount = objects.length > 3 ? ` +${objects.length - 3} more` : '';
    
    await this.sendNotification({
      title: '🎯 Objects Detected!',
      body: `Found: ${objectList}${extraCount} (${Math.round(confidence * 100)}% confidence)`,
      icon: '/favicon.ico',
      tag: 'object-detected',
      requireInteraction: false,
      data: { type: 'object-detected', objects, confidence }
    });
  }
  
  async notifyError(error: string, actionable: boolean = false): Promise<void> {
    await this.sendNotification({
      title: '⚠️ AI Live Cam Alert',
      body: error,
      icon: '/favicon.ico',
      tag: 'error',
      requireInteraction: actionable,
      actions: actionable ? [
        {
          action: 'retry',
          title: '🔄 Retry',
          icon: '/favicon.ico'
        },
        {
          action: 'settings',
          title: '⚙️ Settings',
          icon: '/favicon.ico'
        }
      ] : [],
      data: { type: 'error', error, actionable }
    });
  }
  
  async notifyInstallPrompt(): Promise<void> {
    await this.sendNotification({
      title: '📱 Install AI Live Cam',
      body: 'Add to your home screen for the best experience with offline access!',
      icon: '/favicon.ico',
      tag: 'install-prompt',
      requireInteraction: true,
      actions: [
        {
          action: 'install',
          title: '📥 Install App',
          icon: '/favicon.ico'
        },
        {
          action: 'later',
          title: '⏰ Maybe Later',
          icon: '/favicon.ico'
        }
      ],
      data: { type: 'install-prompt' }
    });
  }
  
  // Clear all notifications with a specific tag
  async clearNotifications(tag?: string): Promise<void> {
    if (!this.registration) return;
    
    try {
      const notifications = await this.registration.getNotifications({ tag });
      notifications.forEach(notification => notification.close());
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }
  
  // Get active notifications
  async getActiveNotifications(tag?: string): Promise<Notification[]> {
    if (!this.registration) return [];
    
    try {
      return await this.registration.getNotifications({ tag });
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }
}

// Export singleton instance
export const pushNotificationService = PushNotificationService.getInstance();

// Helper hook for React components
export const usePushNotifications = () => {
  const service = PushNotificationService.getInstance();
  
  return {
    isSupported: service.isSupported(),
    getPermissionStatus: () => service.getPermissionStatus(),
    requestPermission: () => service.requestPermission(),
    initialize: () => service.initialize(),
    notify: (options: PushNotificationOptions) => service.sendNotification(options),
    notifyBatchComplete: (batchCount: number, totalImages: number) => 
      service.notifyBatchComplete(batchCount, totalImages),
    notifyAIAnalysisComplete: (imageCount: number, processingTime: number) => 
      service.notifyAIAnalysisComplete(imageCount, processingTime),
    notifyObjectDetected: (objects: string[], confidence: number) => 
      service.notifyObjectDetected(objects, confidence),
    notifyError: (error: string, actionable?: boolean) => 
      service.notifyError(error, actionable),
    notifyInstallPrompt: () => service.notifyInstallPrompt(),
    clearNotifications: (tag?: string) => service.clearNotifications(tag),
    getActiveNotifications: (tag?: string) => service.getActiveNotifications(tag)
  };
};