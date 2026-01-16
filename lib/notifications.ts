// Browser Notification Utility for Help Desk

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

  if (Notification.permission !== 'granted') {
    console.log('Notification permission not granted');
    return null;
  }

  // Check if the page is currently visible/focused
  const isPageVisible = document.visibilityState === 'visible' && document.hasFocus();
  
  // Only show notification if page is not visible
  if (isPageVisible) {
    console.log('Page is visible, skipping notification');
    return null;
  }

  const title = `${userName} needs assistance`;
  const body = message || 'Click to open chat';

  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico', // Make sure you have a favicon
    badge: '/favicon.ico',
    tag: `user-${userId}`, // Prevents duplicate notifications for same user
    requireInteraction: false,
    silent: false,
    data: {
      userId,
      roomId,
      userName,
    },
  });

  // Handle notification click - redirect to user's chat
  notification.onclick = (event) => {
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
    console.error('Notification error:', error);
  };

  return notification;
};

export const showNewMessageNotification = (
  userName: string,
  message: string,
  userId: string,
  roomId: string
) => {
  if (Notification.permission !== 'granted') {
    return null;
  }

  // Check if the page is currently visible/focused
  const isPageVisible = document.visibilityState === 'visible' && document.hasFocus();
  
  // Only show notification if page is not visible
  if (isPageVisible) {
    return null;
  }

  const title = `New message from ${userName}`;
  const body = message.length > 100 ? message.substring(0, 100) + '...' : message;

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

  return notification;
};
