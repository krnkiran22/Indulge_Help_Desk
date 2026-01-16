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

  if (!('Notification' in window)) {
    console.error('❌ This browser does not support notifications');
    alert('Browser notifications not supported');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('❌ Notification permission not granted:', Notification.permission);
    alert('Please allow notifications in your browser settings');
    return null;
  }

  const title = `${userName} needs assistance`;
  const body = message || 'Click to open chat';
  const tag = `user-${userId}`;

  console.log('✅ Creating notification:', { title, body });

  // Try Service Worker API first (required for mobile Chrome)
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
        icon: '/favicon.ico',
        badge: '/favicon.ico',
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

  if (Notification.permission !== 'granted') {
    console.warn('❌ Notification permission not granted');
    return null;
  }

  const title = `New message from ${userName}`;
  const body = message.length > 100 ? message.substring(0, 100) + '...' : message;
  const tag = `message-${userId}`;

  console.log('✅ Creating message notification:', { title, body });

  // Try Service Worker API first (required for mobile Chrome)
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
        icon: '/favicon.ico',
        badge: '/favicon.ico',
      });

      console.log('✅ Service Worker message notification created successfully');
      return true;
    } catch (swError) {
      console.warn('⚠️ Service Worker notification failed, trying direct API:', swError);
    }
  }

  // Fallback to direct Notification API
  try {
    const notification = new Notification(title, {
      body,
      tag,
      requireInteraction: false,
      silent: false,
    });

    console.log('✅ Message notification created successfully');

    notification.onclick = (event) => {
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
      console.error('❌ Message notification error:', error);
    };

    return notification;
  } catch (error) {
    console.error('❌ Failed to create message notification:', error);
    return null;
  }
};
