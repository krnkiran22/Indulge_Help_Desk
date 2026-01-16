'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { initializeSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { 
  requestNotificationPermission, 
  showUserConnectionNotification,
  showNewMessageNotification,
  checkNotificationSupport
} from '@/lib/notifications';

interface ChatSession {
  userId: string;
  userName: string;
  roomId: string;
  lastMessage: string;
  timestamp: Date;
  unread: number;
  agentMode: boolean;
}



// URL detection regex - improved to catch all URL pattern
const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\b[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;

// Parse text and convert URLs to clickable links
const parseTextWithLinks = (text: string, isAgent: boolean = false) => {
  if (!text) return text;

  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  // Create a new regex instance for each parse to reset state
  const regex = new RegExp(URL_REGEX.source, URL_REGEX.flags);

  while ((match = regex.exec(text)) !== null) {
    const url = match[0];
    const index = match.index;

    // Add text before the URL
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index));
    }

    // Prepare the full URL
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = 'https://' + url;
    }

    // Add the clickable link - use black for agent messages, blue for others
    parts.push(
      <a
        key={`link-${key++}`}
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${isAgent ? 'text-black' : 'text-blue-400'} hover:opacity-80 underline font-semibold`}
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );

    lastIndex = index + url.length;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  // If no parts were created (no URLs found), return the original text
  if (parts.length === 0) {
    return text;
  }

  return parts;
};

// Format date separator (Today, Yesterday, or date)
const formatDateSeparator = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const messageDate = new Date(date);
  
  // Reset time to compare dates only
  today.setHours(0, 0, 0, 0);
  yesterday.setHours(0, 0, 0, 0);
  messageDate.setHours(0, 0, 0, 0);

  if (messageDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    // Format as "Month Day, Year" (e.g., "January 9, 2026")
    return messageDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }
};

// Check if two dates are on different days
const isDifferentDay = (date1: Date, date2: Date): boolean => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return d1.getTime() !== d2.getTime();
};

export default function DashboardPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [adminName, setAdminName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'active' | 'all'>('active');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [showFileModal, setShowFileModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const router = useRouter();
  const selectedSessionRef = useRef<ChatSession | null>(null);
  const sessionsRef = useRef<ChatSession[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const adminUser = localStorage.getItem('adminUser');

    console.log('🔐 Admin Token:', token ? 'Token exists' : 'No token');
    console.log('👤 Admin User:', adminUser);

    if (!token) {
      router.push('/login');
      return;
    }

    // Register Service Worker for notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('✅ Service Worker registered:', registration);
        })
        .catch(error => {
          console.warn('⚠️ Service Worker registration failed:', error);
        });
      
      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SELECT_USER') {
          const { userId, roomId, userName } = event.data;
          console.log('📨 Message from SW: Select user', userName);
          
          const session = sessionsRef.current.find(s => s.userId === userId || s.roomId === roomId);
          if (session) {
            setSelectedSession(session);
          }
        }
      });
    }

    // Request notification permission
    requestNotificationPermission().then(permission => {
      console.log('🔔 Notification permission:', permission);
    });

    // Listen for notification clicks to select user
    const handleNotificationSelection = (event: any) => {
      const { userId, roomId, userName } = event.detail;
      console.log('🔔 Notification clicked, selecting user:', userName);
      
      // Find the session and select it
      const session = sessionsRef.current.find(s => s.userId === userId || s.roomId === roomId);
      if (session) {
        setSelectedSession(session);
      }
    };

    window.addEventListener('selectUserFromNotification', handleNotificationSelection);

    // Check if there's a pending selection from sessionStorage
    const pendingUserId = sessionStorage.getItem('selectUserId');
    const pendingRoomId = sessionStorage.getItem('selectRoomId');
    
    if (pendingUserId && pendingRoomId) {
      sessionStorage.removeItem('selectUserId');
      sessionStorage.removeItem('selectRoomId');
      
      // Delay selection to ensure sessions are loaded
      setTimeout(() => {
        const session = sessionsRef.current.find(
          s => s.userId === pendingUserId || s.roomId === pendingRoomId
        );
        if (session) {
          setSelectedSession(session);
        }
      }, 500);
    }

    // Decode token to see what's inside (for debugging)
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        console.log('🔍 Decoded Token Payload:', payload);
        console.log('🆔 User ID in token:', payload._id);
      }
    } catch (e) {
      console.error('Failed to decode token:', e);
    }

    if (adminUser) {
      const user = JSON.parse(adminUser);
      setAdminName(user.full_name || 'Admin');
    }

    const socket = initializeSocket(token);

    socket.on('connected', (data) => {
      console.log('Admin connected:', data);
      setLoading(false);
    });

    // Listen for active sessions (sent when admin connects)
    socket.on('active_sessions', (data) => {
      console.log('Active sessions received:', data);
      if (data.sessions && data.sessions.length > 0) {
        const formattedSessions: ChatSession[] = data.sessions.map((s: any) => ({
          userId: s.userId,
          userName: s.userName || 'User',
          roomId: s.roomId,
          lastMessage: s.lastMessage || 'Requested agent connection',
          timestamp: new Date(s.requestedAt || s.connectedAt || new Date()),
          unread: 0,
          agentMode: true,
        }));
        setSessions(formattedSessions);
      }
    });

    // Listen for users requesting agent connection
    socket.on('agent_connection_request', (data) => {
      console.log('Agent connection requested:', data);
      
      // Show browser notification
      showUserConnectionNotification({
        userId: data.userId,
        userName: data.userName || 'User',
        roomId: data.roomId || `user_${data.userId}`,
        message: 'Requested agent connection'
      });
      
      // Add or update session
      setSessions((prev) => {
        const existing = prev.find((s) => s.userId === data.userId);
        if (existing) {
          return prev.map((s) =>
            s.userId === data.userId
              ? { ...s, agentMode: true, unread: s.unread + 1 }
              : s
          );
        }
        return [
          ...prev,
          {
            userId: data.userId,
            userName: data.userName || 'User',
            roomId: data.roomId || `user_${data.userId}`,
            lastMessage: 'Requested agent connection',
            timestamp: new Date(),
            unread: 1,
            agentMode: true,
          },
        ];
      });
    });

    // Listen for chat history
    socket.on('chat_history', (data) => {
      console.log('📜 Chat history received:', data);
      console.log('📊 Number of messages:', data.messages?.length || 0);
      if (data.success && data.messages) {
        // Log detailed attachment info for each message
        data.messages.forEach((msg: any, idx: number) => {
          if (msg.attachments && msg.attachments.length > 0) {
            console.log(`📎 Message ${idx} (${msg.role}) has attachments:`, {
              message: msg.message,
              attachments: msg.attachments.map((a: any) => ({
                type: a.type,
                filename: a.filename,
                hasBase64: !!a.base64Data,
                hasUrl: !!a.url,
                base64Length: a.base64Data?.length || 0,
                mimeType: a.mimeType
              }))
            });
          }
        });
        
        // Map database messages to display format with unique IDs
        const formattedMessages = data.messages.map((msg: any) => ({
          id: msg._id || `${msg.role}-${msg.timestamp}-${msg.message.substring(0, 20)}`, // Add unique ID
          message: msg.message,
          role: msg.role,
          timestamp: msg.timestamp,
          attachments: msg.attachments || [],
          agentName: msg.metadata?.agentName
        }));
        console.log('✅ Setting messages:', formattedMessages.length);
        console.log('📋 Messages with attachments:', formattedMessages.filter((m: any) => m.attachments?.length > 0).length);
        setMessages(formattedMessages);
      } else {
        console.log('⚠️ No messages or failed:', data);
        setMessages([]);
      }
    });

    // Listen for user messages (when user sends message in AGENT mode)
    socket.on('user_message', (data) => {
      console.log('📨 [Help Desk] Received user_message event');
      console.log('  Message:', data.message);
      console.log('  Room:', data.roomId);
      console.log('  Attachments received:', data.attachments?.length || 0);
      if (data.attachments && data.attachments.length > 0) {
        console.log('  Attachment details:', data.attachments.map((a: any) => ({ 
          type: a.type, 
          filename: a.filename,
          hasBase64: !!a.base64Data,
          hasUrl: !!a.url 
        })));
      }
      console.log('👤 User message received:', {
        message: data.message,
        roomId: data.roomId,
        userId: data.userId,
        userName: data.userName,
        timestamp: data.timestamp,
        attachments: data.attachments?.length || 0
      });
      console.log('🎯 Currently selected session:', {
        roomId: selectedSessionRef.current?.roomId,
        userName: selectedSessionRef.current?.userName
      });
      console.log('🔍 Room match:', data.roomId === selectedSessionRef.current?.roomId);
      
      // Show notification if not currently viewing this chat
      if (!selectedSessionRef.current || data.roomId !== selectedSessionRef.current.roomId) {
        const notificationMessage = data.message || (data.attachments?.length ? 
          `Sent ${data.attachments.length} attachment(s)` : 'New message');
        showNewMessageNotification(
          data.userName || 'User',
          notificationMessage,
          data.userId,
          data.roomId
        );
      }
      
      // Add to messages if this is the selected session
      if (selectedSessionRef.current && data.roomId === selectedSessionRef.current.roomId) {
        console.log('✅ Adding user message to chat with attachments:', data.attachments?.length || 0);
        if (data.attachments && data.attachments.length > 0) {
          console.log('📎 Attachments:', data.attachments.map((a: any) => ({ type: a.type, filename: a.filename })));
        }
        
        // Check for duplicates before adding
        setMessages((prev) => {
          // Check if message already exists by ID or by content+timestamp+attachments
          const isDuplicate = prev.some(msg => {
            const sameContent = msg.message === data.message;
            const sameRole = msg.role === 'user';
            const sameTime = Math.abs(new Date(msg.timestamp).getTime() - new Date(data.timestamp).getTime()) < 2000;
            const sameAttachmentCount = (msg.attachments?.length || 0) === (data.attachments?.length || 0);
            
            // For attachment-only messages, also check attachment filenames
            if (!data.message || data.message.trim() === '') {
              const sameAttachments = JSON.stringify(msg.attachments?.map((a: any) => a.filename).sort()) === 
                                     JSON.stringify(data.attachments?.map((a: any) => a.filename).sort());
              return sameContent && sameRole && sameTime && sameAttachments;
            }
            
            return sameContent && sameRole && sameTime && sameAttachmentCount;
          });
          
          if (isDuplicate) {
            console.log('⚠️ Duplicate user message detected, skipping');
            return prev;
          }
          
          // Add with unique ID
          return [...prev, {
            id: `user-${data.timestamp}-${data.userId}`,
            message: data.message,
            role: 'user',
            timestamp: data.timestamp,
            attachments: data.attachments || [],
            userName: data.userName
          }];
        });
      } else {
        console.log('⚠️ Not adding - room mismatch or no session selected');
      }
      
      // Update session list with user's message
      setSessions((prev) =>
        prev.map((s) => {
          if (s.roomId === data.roomId) {
            // Show attachment indicator if message is empty
            let displayMessage = data.message || '';
            if (!displayMessage && data.attachments && data.attachments.length > 0) {
              displayMessage = `📎 ${data.attachments.length} attachment(s)`;
            }
            
            return { 
              ...s, 
              lastMessage: displayMessage.substring(0, 50) + (displayMessage.length > 50 ? '...' : ''), 
              timestamp: new Date(data.timestamp),
              unread: selectedSessionRef.current?.roomId === data.roomId ? s.unread : s.unread + 1
            };
          }
          return s;
        })
      );
    });

    // Listen for AI responses (so admin can see AI replies in real-time)
    socket.on('ai_response', (data) => {
      console.log('🤖 AI response received:', {
        message: data.message,
        roomId: data.roomId
      });
      
      // Check if this session is in agent mode - if yes, ignore AI response
      const session = sessionsRef.current.find(s => s.roomId === data.roomId);
      if (session?.agentMode) {
        console.log('⚠️ Ignoring AI response - session is in AGENT mode');
        return;
      }
      
      // Add to messages if this is the selected session and NOT in agent mode
      if (selectedSessionRef.current && 
          data.roomId === selectedSessionRef.current.roomId && 
          !selectedSessionRef.current.agentMode) {
        console.log('✅ Adding AI response to chat (AI mode)');
        setMessages((prev) => [...prev, {
          message: data.message,
          role: 'assistant',
          timestamp: data.timestamp,
          attachments: []
        }]);
      }
      
      // Update session list with AI's response only if NOT in agent mode
      setSessions((prev) =>
        prev.map((s) =>
          s.roomId === data.roomId && !s.agentMode
            ? { ...s, lastMessage: data.message.substring(0, 50) + '...', timestamp: new Date(data.timestamp) }
            : s
        )
      );
    });

    // Listen for agent message echo from server
    socket.on('agent_message', (data) => {
      console.log('👔 Agent message echo received:', data);
      // Update the optimistic message with the server version (which has _id)
      setMessages((prev) => {
        // Check if we already have this message (by timestamp + message content)
        const exists = prev.some(msg => 
          msg.message === data.message && 
          msg.role === 'agent' &&
          Math.abs(new Date(msg.timestamp).getTime() - new Date(data.timestamp).getTime()) < 2000
        );
        
        if (exists) {
          // Update the existing optimistic message with server data
          return prev.map(msg => 
            msg.message === data.message && 
            msg.role === 'agent' &&
            Math.abs(new Date(msg.timestamp).getTime() - new Date(data.timestamp).getTime()) < 2000
              ? { ...data, id: data._id || msg.id }
              : msg
          );
        } else {
          // New message from another admin
          return [...prev, { ...data, id: data._id }];
        }
      });
    });

    // Listen for message sent confirmation
    socket.on('message_sent', (data) => {
      console.log('✅ Message sent confirmation:', data);
      // Message successfully delivered - already added optimistically
    });

    return () => {
      window.removeEventListener('selectUserFromNotification', handleNotificationSelection as any);
      disconnectSocket();
    };
  }, [router]); // Removed selectedSession from dependencies

  const handleSelectSession = (session: ChatSession) => {
    console.log('🎯 Admin selecting session:', {
      userId: session.userId,
      userName: session.userName,
      roomId: session.roomId,
      agentMode: session.agentMode
    });
    setSelectedSession(session);
    const socket = getSocket();
    if (socket) {
      console.log('📤 Admin joining room:', session.roomId);
      // Let backend know admin joined this session
      socket.emit('admin_join_session', { roomId: session.roomId });
      
      console.log('📤 Requesting chat history for room:', session.roomId);
      // Request chat history
      socket.emit('get_history', { roomId: session.roomId, limit: 100 });
    }
    // Mark as read
    setSessions((prev) =>
      prev.map((s) => (s.roomId === session.roomId ? { ...s, unread: 0 } : s))
    );
  };

  const handleSendMessage = (e: React.FormEvent, attachments: any[] = []) => {
    e.preventDefault();
    if ((!messageInput.trim() && attachments.length === 0) || !selectedSession) return;

    const socket = getSocket();
    console.log('🔍 Socket exists?', !!socket);
    console.log('🔍 Socket connected?', socket?.connected);
    console.log('🔍 Socket ID:', socket?.id);
    
    if (!socket || !socket.connected) {
      console.error('❌ Socket is not connected! Cannot send message.');
      alert('Connection lost. Please refresh the page.');
      return;
    }
    
    const agentMessage = {
      message: messageInput.trim() || (attachments.length > 0 ? '' : ''),
      roomId: selectedSession.roomId,
      role: 'agent',
      agentName: adminName,
      attachments: attachments
    };

    console.log('📤 Admin sending message:', {
      message: messageInput,
      roomId: selectedSession.roomId,
      toUser: selectedSession.userName,
      attachments: attachments.length,
      attachmentDetails: attachments.map(a => ({
        type: a.type,
        filename: a.filename,
        hasBase64: !!a.base64Data,
        base64Length: a.base64Data?.length || 0,
        hasUrl: !!a.url,
        size: a.size
      }))
    });
    console.log('📤 Full agent message payload:', JSON.stringify(agentMessage).substring(0, 1000));

    // Emit message to user with acknowledgment callback
    console.log('🚀 About to emit agent_message...');
    socket.emit('agent_message', agentMessage, (response: any) => {
      if (response?.success) {
        console.log('✅ Message acknowledged by server:', response);
      } else {
        console.error('❌ Server rejected message:', response);
      }
    });
    console.log('✅ agent_message emitted successfully');

    // Add to local messages optimistically
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        ...agentMessage,
        id: tempId,
        timestamp: new Date(),
      },
    ]);

    setMessageInput('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Please select a valid image (JPEG, PNG, GIF) or PDF file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setShowFileModal(true);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleSendFile = async () => {
    console.log('🚀 handleSendFile called!');
    console.log('📎 Selected file:', selectedFile?.name);
    console.log('👤 Selected session:', selectedSession?.userName, selectedSession?.roomId);
    
    if (!selectedFile || !selectedSession) {
      console.error('❌ Missing file or session:', { selectedFile: !!selectedFile, selectedSession: !!selectedSession });
      return;
    }

    console.log('✅ Proceeding with file upload...');
    setUploadingFile(true);

    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('📖 FileReader finished reading file');
        const base64Data = (reader.result as string).split(',')[1];
        const dataUri = `data:${selectedFile.type};base64,${base64Data}`;
        
        const attachment = {
          type: selectedFile.type.startsWith('image/') ? 'image' : 'pdf',
          filename: selectedFile.name,
          mimeType: selectedFile.type,
          size: selectedFile.size,
          base64Data: base64Data,
          url: dataUri, // Add data URI for mobile app compatibility
        };

        handleSendMessage({ preventDefault: () => {} } as any, [attachment]);
        
        // Close modal and reset
        setShowFileModal(false);
        setSelectedFile(null);
        setFilePreview(null);
        setUploadingFile(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
      setUploadingFile(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    disconnectSocket();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-black text-white">
      {/* Header */}
      <header className="bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-yellow-500">Indulge Help Desk</h1>
          <p className="text-sm text-zinc-400">Admin: {adminName}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              console.log('🧪 Testing notification...');
              checkNotificationSupport();
              console.log('🧪 Permission:', Notification.permission);
              const result = showUserConnectionNotification({
                userId: 'test-user',
                userName: 'Test User',
                roomId: 'test-room',
                message: 'This is a test notification'
              });
              console.log('🧪 Notification result:', result);
              
              // Also try a basic browser notification
              setTimeout(() => {
                console.log('🧪 Trying basic Notification API directly...');
                try {
                  const basic = new Notification('Direct Test', {
                    body: 'Testing basic notification',
                    requireInteraction: true
                  });
                  console.log('✅ Basic notification created:', basic);
                } catch (e) {
                  console.error('❌ Basic notification failed:', e);
                }
              }, 1000);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-sm"
          >
            Test Notification
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sessions List */}
        <div className="w-80 bg-zinc-950 border-r border-zinc-800 flex flex-col">
          {/* Filter Tabs */}
          <div className="p-4 border-b border-zinc-800">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setActiveFilter('active')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeFilter === 'active'
                    ? 'bg-yellow-500 text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                Active Chats
              </button>
              <button
                onClick={() => setActiveFilter('all')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-yellow-500 text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                All Chats
              </button>
            </div>
            <p className="text-sm text-zinc-400">
              {activeFilter === 'active'
                ? `${sessions.filter(s => s.agentMode).length} active`
                : `${sessions.length} total conversations`}
            </p>
          </div>
          
          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800">
            {(() => {
              const filteredSessions = activeFilter === 'active' 
                ? sessions.filter(s => s.agentMode)
                : sessions;
              
              if (filteredSessions.length === 0) {
                return (
                  <div className="p-4 text-center text-zinc-500">
                    <p>No {activeFilter === 'active' ? 'active' : ''} chats</p>
                    <p className="text-sm mt-2">
                      {activeFilter === 'active' 
                        ? 'Waiting for users to request agent...'
                        : 'No chat history available'}
                    </p>
                  </div>
                );
              }
              
              return filteredSessions.map((session) => (
                <button
                  key={session.roomId}
                  onClick={() => handleSelectSession(session)}
                  className={`w-full p-4 text-left hover:bg-zinc-900 transition-colors ${
                    selectedSession?.roomId === session.roomId ? 'bg-zinc-900' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{session.userName}</h3>
                        {session.agentMode && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                            Agent
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 truncate mt-1">{session.lastMessage}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {new Date(session.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    {session.unread > 0 && (
                      <span className="ml-2 px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full">
                        {session.unread}
                      </span>
                    )}
                  </div>
                </button>
              ));
            })()}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedSession ? (
            <>
              {/* Chat Header */}
              <div className="bg-zinc-950 border-b border-zinc-800 px-6 py-4">
                <h2 className="text-lg font-semibold">{selectedSession.userName}</h2>
                <p className="text-sm text-zinc-400">{selectedSession.roomId}</p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, idx) => {
                  // Debug log for each message
                  if (msg.attachments && msg.attachments.length > 0) {
                    console.log(`🎨 Rendering message ${idx} (${msg.role}) with attachments:`, {
                      message: msg.message?.substring(0, 50),
                      attachmentCount: msg.attachments.length,
                      attachments: msg.attachments.map((a: any) => ({
                        type: a.type,
                        filename: a.filename,
                        hasBase64: !!a.base64Data,
                        hasUrl: !!a.url,
                        mimeType: a.mimeType,
                        size: a.size
                      }))
                    });
                  }
                  
                  // Check if we need to show a date separator
                  const showDateSeparator = idx === 0 || 
                    isDifferentDay(new Date(messages[idx - 1].timestamp), new Date(msg.timestamp));
                  
                  return (
                    <div key={idx}>
                      {/* Date Separator */}
                      {showDateSeparator && (
                        <div className="flex items-center justify-center my-4">
                          <div className="px-4 py-1.5 bg-zinc-800 rounded-full text-xs text-zinc-400 font-medium">
                            {formatDateSeparator(new Date(msg.timestamp))}
                          </div>
                        </div>
                      )}
                      
                      {/* Message */}
                  <div
                    className={`flex ${msg.role === 'agent' || msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        msg.role === 'agent'
                          ? 'bg-yellow-500 text-black'
                          : msg.role === 'assistant'
                          ? 'bg-zinc-800 text-white'
                          : 'bg-zinc-900 text-white'
                      }`}
                    >
                      {/* Display attachments (images, PDFs, links) */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mb-2 space-y-2">
                          {msg.attachments.map((attachment: any, attIdx: number) => {
                            console.log(`🖼️ Rendering attachment ${attIdx} in message ${idx}:`, {
                              type: attachment.type,
                              filename: attachment.filename,
                              hasBase64: !!attachment.base64Data,
                              hasUrl: !!attachment.url
                            });
                            
                            if (attachment.type === 'image') {
                              // Construct image URL - handle base64, regular URL, or data URL
                              let imageUrl = '';
                              
                              if (attachment.base64Data) {
                                // Has base64 data - create data URL
                                imageUrl = `data:${attachment.mimeType || 'image/jpeg'};base64,${attachment.base64Data}`;
                              } else if (attachment.url) {
                                // Check if URL is already a data URL or regular URL
                                imageUrl = attachment.url;
                              } else if (attachment.uri) {
                                // Fallback to uri field
                                imageUrl = attachment.uri;
                              }

                              console.log('🖼️ Image attachment:', {
                                filename: attachment.filename,
                                hasBase64: !!attachment.base64Data,
                                hasUrl: !!attachment.url,
                                urlPreview: imageUrl?.substring(0, 100),
                                isDataUrl: imageUrl?.startsWith('data:')
                              });
                              
                              if (!imageUrl) {
                                return (
                                  <div key={attIdx} className="p-4 bg-zinc-800/50 rounded-lg text-zinc-400 text-sm">
                                    📷 Image unavailable: {attachment.filename || 'Unknown'}
                                  </div>
                                );
                              }
                              
                              return (
                                <img
                                  key={attIdx}
                                  src={imageUrl}
                                  alt={attachment.filename || 'Image'}
                                  className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                  style={{ maxHeight: '300px', objectFit: 'contain' }}
                                  onClick={() => {
                                    setImagePreviewUrl(imageUrl);
                                    setShowImagePreview(true);
                                  }}
                                  onError={(e) => {
                                    console.error('❌ Failed to load image:', attachment.filename);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              );
                            }
                            if (attachment.type === 'pdf') {
                              // Construct PDF URL from base64 if URL is not present
                              const pdfUrl = attachment.url || (attachment.base64Data 
                                ? `data:${attachment.mimeType || 'application/pdf'};base64,${attachment.base64Data}`
                                : null);
                              
                              return (
                                <a
                                  key={attIdx}
                                  href={pdfUrl || '#'}
                                  download={attachment.filename || 'document.pdf'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                                  onClick={(e) => {
                                    if (!pdfUrl) {
                                      e.preventDefault();
                                      alert('PDF file is not available');
                                    }
                                  }}
                                >
                                  <span className="text-2xl">📑</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{attachment.filename || 'PDF Document'}</p>
                                    {attachment.size && (
                                      <p className="text-xs text-zinc-400">{(attachment.size / 1024 / 1024).toFixed(2)} MB</p>
                                    )}
                                    <p className="text-xs text-zinc-500">Click to download</p>
                                  </div>
                                </a>
                              );
                            }
                            if (attachment.type === 'link') {
                              return (
                                <a
                                  key={attIdx}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                                >
                                  <span className="text-xl">🔗</span>
                                  <p className="text-sm flex-1 min-w-0 truncate">{attachment.linkText || attachment.url}</p>
                                </a>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                      
                      {/* Only show message text if it exists */}
                      {msg.message && msg.message.trim() && (
                        <p className="text-sm whitespace-pre-wrap break-all">{parseTextWithLinks(msg.message, msg.role === 'agent')}</p>
                      )}
                      <p className="text-xs mt-1 opacity-70">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                    </div>
                  );
                })}
              </div>

              {/* Message Input */}
              <div className="bg-zinc-950 border-t border-zinc-800 p-4">
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="file-upload"
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                    title="Attach Image or PDF"
                  >
                    📎
                  </label>
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type your message..."
                    rows={1}
                    className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                    style={{ minHeight: '48px', maxHeight: '200px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSendMessage(e);
                    }}
                    disabled={!messageInput.trim()}
                    className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-500/50 text-black font-semibold rounded-lg transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* File Upload Modal */}
              {showFileModal && selectedFile && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowFileModal(false)}>
                  <div className="bg-zinc-900 rounded-lg p-6 w-96 max-w-[90%]" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-xl font-bold mb-4 text-yellow-500">
                      {selectedFile.type.startsWith('image/') ? 'Send Image' : 'Send PDF'}
                    </h3>
                    
                    {/* File Preview */}
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="w-full max-h-64 object-contain mb-4 rounded-lg bg-zinc-800" />
                    ) : (
                      <div className="w-full p-8 mb-4 rounded-lg bg-zinc-800 flex flex-col items-center justify-center">
                        <span className="text-6xl mb-2">📑</span>
                        <p className="text-sm text-zinc-400">{selectedFile.name}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    )}

                    {/* Optional message */}
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Add a message (optional)"
                      className="w-full px-4 py-2 mb-4 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowFileModal(false);
                          setSelectedFile(null);
                          setFilePreview(null);
                        }}
                        className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                        disabled={uploadingFile}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSendFile}
                        disabled={uploadingFile}
                        className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-500/50 text-black font-semibold rounded-lg transition-colors"
                      >
                        {uploadingFile ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-lg">Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {showImagePreview && imagePreviewUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95"
          onClick={() => setShowImagePreview(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowImagePreview(false)}
            className="absolute top-4 right-4 z-50 w-12 h-12 flex items-center justify-center rounded-full bg-black bg-opacity-60 hover:bg-opacity-80 transition-all"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Full-screen image */}
          <img
            src={imagePreviewUrl}
            alt="Full screen preview"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
