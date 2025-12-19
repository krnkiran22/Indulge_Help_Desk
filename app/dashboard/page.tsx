'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { initializeSocket, disconnectSocket, getSocket } from '@/lib/socket';

interface ChatSession {
  userId: string;
  userName: string;
  roomId: string;
  lastMessage: string;
  timestamp: Date;
  unread: number;
  agentMode: boolean;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [adminName, setAdminName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'active' | 'all'>('active');
  const [linkInput, setLinkInput] = useState('');
  const [linkTextInput, setLinkTextInput] = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
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
        setMessages(formattedMessages);
      } else {
        console.log('⚠️ No messages or failed:', data);
        setMessages([]);
      }
    });

    // Listen for user messages (when user sends message in AGENT mode)
    socket.on('user_message', (data) => {
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
      
      // Add to messages if this is the selected session
      if (selectedSessionRef.current && data.roomId === selectedSessionRef.current.roomId) {
        console.log('✅ Adding user message to chat with attachments:', data.attachments?.length || 0);
        if (data.attachments && data.attachments.length > 0) {
          console.log('📎 Attachments:', data.attachments.map((a: any) => ({ type: a.type, filename: a.filename })));
        }
        
        // Check for duplicates before adding
        setMessages((prev) => {
          // Check if message already exists by ID or by content+timestamp
          const isDuplicate = prev.some(msg => 
            (msg.message === data.message &&
            msg.role === 'user' &&
            Math.abs(new Date(msg.timestamp).getTime() - new Date(data.timestamp).getTime()) < 2000)
          );
          
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
        prev.map((s) =>
          s.roomId === data.roomId
            ? { 
                ...s, 
                lastMessage: data.message.substring(0, 50) + (data.message.length > 50 ? '...' : ''), 
                timestamp: new Date(data.timestamp),
                unread: selectedSessionRef.current?.roomId === data.roomId ? s.unread : s.unread + 1
              }
            : s
        )
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

    // Listen for agent message echo (don't add if we already added it optimistically)
    socket.on('agent_message', (data) => {
      console.log('👔 Agent message echo received:', data);
      // Backend echoes our own message back - we already added it optimistically, so skip
      // But if another admin sent it, we should add it
      // For now, just log it to avoid duplicates
    });

    // Listen for message sent confirmation
    socket.on('message_sent', (data) => {
      console.log('✅ Message sent confirmation:', data);
      // Message successfully delivered - already added optimistically
    });

    return () => {
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
    if (socket) {
      const agentMessage = {
        message: messageInput || 'Attachment',
        roomId: selectedSession.roomId,
        role: 'agent',
        agentName: adminName,
        attachments: attachments
      };

      console.log('📤 Admin sending message:', {
        message: messageInput,
        roomId: selectedSession.roomId,
        toUser: selectedSession.userName,
        attachments: attachments.length
      });

      // Emit message to user
      socket.emit('agent_message', agentMessage);

      // Add to local messages
      setMessages((prev) => [
        ...prev,
        {
          ...agentMessage,
          timestamp: new Date(),
        },
      ]);

      setMessageInput('');
    }
  };

  const handleSendLink = () => {
    if (!linkInput.trim() || !selectedSession) return;
    
    const linkAttachment = {
      type: 'link',
      url: linkInput,
      linkText: linkTextInput || linkInput
    };
    
    handleSendMessage({ preventDefault: () => {} } as any, [linkAttachment]);
    setLinkInput('');
    setLinkTextInput('');
    setShowLinkModal(false);
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
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          Logout
        </button>
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
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
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
                            if (attachment.type === 'image') {
                              const imageUrl = attachment.base64Data
                                ? `data:${attachment.mimeType || 'image/jpeg'};base64,${attachment.base64Data}`
                                : attachment.url || attachment.uri;
                              
                              return (
                                <img
                                  key={attIdx}
                                  src={imageUrl}
                                  alt={attachment.filename || 'Image'}
                                  className="max-w-full rounded-lg"
                                  style={{ maxHeight: '300px', objectFit: 'contain' }}
                                />
                              );
                            }
                            if (attachment.type === 'pdf') {
                              return (
                                <a
                                  key={attIdx}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                                >
                                  <span className="text-2xl">📑</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{attachment.filename || 'PDF Document'}</p>
                                    {attachment.size && (
                                      <p className="text-xs text-zinc-400">{(attachment.size / 1024 / 1024).toFixed(2)} MB</p>
                                    )}
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
                      
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <form onSubmit={(e) => handleSendMessage(e)} className="bg-zinc-950 border-t border-zinc-800 p-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(true)}
                    className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                    title="Add Link"
                  >
                    🔗
                  </button>
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim()}
                    className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-500/50 text-black font-semibold rounded-lg transition-colors"
                  >
                    Send
                  </button>
                </div>
              </form>

              {/* Link Modal */}
              {showLinkModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowLinkModal(false)}>
                  <div className="bg-zinc-900 rounded-lg p-6 w-96 max-w-[90%]" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-xl font-bold mb-4 text-yellow-500">Add Link</h3>
                    <input
                      type="url"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      placeholder="Enter URL (e.g., https://example.com)"
                      className="w-full px-4 py-2 mb-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <input
                      type="text"
                      value={linkTextInput}
                      onChange={(e) => setLinkTextInput(e.target.value)}
                      placeholder="Link text (optional)"
                      className="w-full px-4 py-2 mb-4 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowLinkModal(false)}
                        className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSendLink}
                        disabled={!linkInput.trim()}
                        className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-500/50 text-black font-semibold rounded-lg transition-colors"
                      >
                        Send Link
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
    </div>
  );
}
