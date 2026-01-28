// Browser Notification Utility for Help Desk

export const checkNotificationSupport = () => {
  const supported = 'Notification' in window;
  const permission = supported ? Notification.permission : 'unsupported';
  
  console.log('🔔 Notification Support Check:');
  console.log('  - Supported:', supported);
  console.log('  - Permission:', permission);
  console.log('  - Browser:', navigator.userAgent);
  console.log('  - Protocol:', window.location.protocol);
  console.log('  - Is Secure Context:', window.isSecureContext);
  
  return { supported, permission };
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
};

export interface NotificationOptions {
  userId: string;
  userName: string;
  roomId: string;
  message?: string;
}

export const showUserConnectionNotification = async (options: NotificationOptions) => {
  const { userName, userId, roomId, message } = options;

  console.log('🔔 Attempting to show notification for:', userName);
  console.log('🔔 Notification permission:', Notification.permission);
  console.log('🔔 Browser:', navigator.userAgent);
  console.log('🔔 Platform:', navigator.platform);

  if (!('Notification' in window)) {
    console.error('❌ This browser does not support notifications');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('❌ Notification permission not granted:', Notification.permission);
    // Try to request permission again
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.error('❌ Notification permission denied');
      return null;
    }
  }

  const title = `${userName} needs assistance`;
  const body = message || 'Click to open chat';
  const tag = `user-${userId}`;

  console.log('✅ Creating notification:', { title, body });

  // For Mac desktop, try direct API first (more reliable than Service Worker)
  if (navigator.platform.includes('Mac')) {
    console.log('🍎 Mac detected - using direct Notification API');
    try {
      const notification = new Notification(title, {
        body,
        requireInteraction: true,
        silent: false,
        tag,
        icon: '/notification-icon.png',
        badge: '/notification-icon.png',
      });

      console.log('✅ Direct Mac notification created successfully');

      notification.onshow = () => {
        console.log('✅ Notification is now visible to user');
        // Play a sound for Mac
        try {
          const audio = new Audio('/notification-sound.mp3');
          audio.play().catch(e => console.log('Could not play sound:', e));
        } catch (e) {
          console.log('Audio not supported');
        }
      };

      notification.onclick = (event) => {
        console.log('🖱️ Notification clicked');
        event.preventDefault();
        window.focus();
        
        sessionStorage.setItem('selectUserId', userId);
        sessionStorage.setItem('selectRoomId', roomId);
        
        window.dispatchEvent(new CustomEvent('selectUserFromNotification', {
          detail: { userId, roomId, userName }
        }));
        
        notification.close();
      };

      notification.onerror = (error) => {
        console.error('❌ Notification error:', error);
      };

      notification.onclose = () => {
        console.log('🔕 Notification closed');
      };

      return notification;
    } catch (error) {
      console.error('❌ Failed to create Mac notification:', error);
    }
  }

  // Try Service Worker API for other platforms
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Service Worker ready, using showNotification');
      
      await registration.showNotification(title, {
        body,
        tag,
        requireInteraction: true,
        silent: false,
        data: { userId, roomId, userName },
        icon: '/notification-icon.png',
        badge: '/notification-icon.png',
      });

      console.log('✅ Service Worker notification created successfully');
      return true;
    } catch (swError) {
      console.warn('⚠️ Service Worker notification failed, trying direct API:', swError);
    }
  }

  // Fallback to direct Notification API (for desktop)
  try {
    const notification = new Notification(title, {
      body,
      requireInteraction: true,
      silent: false,
      tag,
      icon: '/notification-icon.png',
    });

    console.log('✅ Direct notification created successfully');

    notification.onshow = () => {
      console.log('✅ Notification is now visible to user');
    };

    notification.onclick = (event) => {
      console.log('🖱️ Notification clicked');
      event.preventDefault();
      window.focus();
      
      sessionStorage.setItem('selectUserId', userId);
      sessionStorage.setItem('selectRoomId', roomId);
      
      window.dispatchEvent(new CustomEvent('selectUserFromNotification', {
        detail: { userId, roomId, userName }
      }));
      
      notification.close();
    };

    notification.onerror = (error) => {
      console.error('❌ Notification error:', error);
    };

    notification.onclose = () => {
      console.log('🔕 Notification closed');
    };

    return notification;
  } catch (error) {
    console.error('❌ Failed to create notification:', error);
    alert('Failed to create notification: ' + (error as Error).message);
    return null;
  }
};

export const showNewMessageNotification = async (
  userName: string,
  message: string,
  userId: string,
  roomId: string
) => {
  console.log('🔔 Attempting to show message notification from:', userName);
  console.log('🔔 Notification permission:', Notification.permission);
  console.log('🔔 Platform:', navigator.platform);
  console.log('🔔 User Agent:', navigator.userAgent);

  if (!('Notification' in window)) {
    console.error('❌ This browser does not support notifications');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('❌ Notification permission not granted');
    return null;
  }

  const title = `New message from ${userName}`;
  const body = message.length > 100 ? message.substring(0, 100) + '...' : message;
  const tag = `message-${userId}-${Date.now()}`; // Unique tag to prevent grouping

  console.log('✅ Creating message notification:', { title, body, tag });

  // Try direct Notification API first for ALL desktop browsers
  try {
    const notification = new Notification(title, {
      body,
      tag,
      requireInteraction: false,
      silent: false,
      icon: '/notification-icon.png',
      badge: '/notification-icon.png',
    });

    console.log('✅ Desktop notification created successfully');

    notification.onshow = () => {
      console.log('✅ Message notification visible on desktop');
    };

    notification.onclick = (event) => {
      console.log('🖱️ Desktop notification clicked');
      event.preventDefault();
      window.focus();
      
      sessionStorage.setItem('selectUserId', userId);
      sessionStorage.setItem('selectRoomId', roomId);
      
      window.dispatchEvent(new CustomEvent('selectUserFromNotification', {
        detail: { userId, roomId, userName }
      }));
      
      notification.close();
    };

    notification.onerror = (error) => {
      console.error('❌ Desktop notification error:', error);
    };

    notification.onclose = () => {
      console.log('🔕 Desktop notification closed');
    };

    return notification;
  } catch (directError) {
    console.error('❌ Direct Notification API failed:', directError);
  }

  // Fallback to Service Worker API for mobile browsers
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Service Worker ready, using showNotification');
      
      await registration.showNotification(title, {
        body,
        tag,
        requireInteraction: false,
        silent: false,
        data: { userId, roomId, userName },
        icon: '/notification-icon.png',
        badge: '/notification-icon.png',
      });

      console.log('✅ Service Worker message notification created successfully');
      return true;
    } catch (swError) {
      console.warn('⚠️ Service Worker notification failed:', swError);
    }
  }

  console.error('❌ All notification methods failed');
  return null;
};
