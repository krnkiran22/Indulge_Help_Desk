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

export const showUserConnectionNotification = (options: NotificationOptions) => {
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

  console.log('✅ Creating notification:', { title, body });

  try {
    // Try creating a very basic notification first
    const notification = new Notification(title, {
      body,
      requireInteraction: true,
      silent: false,
      tag: `user-${userId}`,
    });

    console.log('✅ Notification created successfully');
    console.log('✅ Notification object:', notification);

    // Add show event listener
    notification.onshow = () => {
      console.log('✅ Notification is now visible to user');
    };

    // Handle notification click - redirect to user's chat
    notification.onclick = (event) => {
      console.log('🖱️ Notification clicked');
      event.preventDefault();
    
    // Focus the window
    window.focus();
    
    // Store the user to select in sessionStorage
    sessionStorage.setItem('selectUserId', userId);
    sessionStorage.setItem('selectRoomId', roomId);
    
    // Dispatch custom event for the dashboard to listen to
    window.dispatchEvent(new CustomEvent('selectUserFromNotification', {
      detail: { userId, roomId, userName }
    }));
    
    // Close the notification
    notification.close();
  };

  notification.onerror = (error) => {
    console.error('❌ Notification error:', error);
    alert('Notification error: ' + JSON.stringify(error));
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

export const showNewMessageNotification = (
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

  console.log('✅ Creating message notification:', { title, body });

  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `message-${userId}`,
      requireInteraction: false,
      silent: false,
      data: {
        userId,
        roomId,
        userName,
      },
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
