# Indulge Help Desk - Admin Chat Portal

## Overview

This is the admin portal for managing real-time chat conversations with Indulge users. When users request to speak with a human agent, admins can respond through this interface.

## Features

- ✅ Secure admin authentication
- ✅ Real-time WebSocket chat with users
- ✅ View all active chat sessions
- ✅ Chat history for each conversation
- ✅ Responsive design (mobile + desktop)
- ✅ Agent mode detection
- ✅ Unread message indicators

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Visit: **http://localhost:3000**

## Usage

### Admin Login

1. Navigate to `/login`
2. Enter admin credentials (use existing backend user account)
3. Click "Sign In"

### Dashboard

1. After login, redirects to `/dashboard`
2. View all active chat sessions in the left sidebar
3. Click on a session to view chat history and respond
4. Type messages and click "Send" to chat with users

## How It Works

**User Side (Mobile App):**

- User chats with AI
- User clicks "Talk to Agent" → emits `request_agent_connection`
- User enters "agent mode" (AI stops responding)

**Admin Side (This Portal):**

- Session appears with "Agent" badge
- Admin clicks session → chat history loads
- Admin sends messages → user receives instantly
- Real-time bidirectional communication

## File Structure

```
app/
├── login/page.tsx       # Login page
├── dashboard/page.tsx   # Main chat interface
├── page.tsx             # Root redirect
lib/
├── api.ts               # REST API client
└── socket.ts            # WebSocket client
.env.local               # Environment config
```

## WebSocket Events

**Admin Receives:**

- `connected` - Connection established
- `agent_connection_request` - User needs agent
- `user_message` - Message from user
- `chat_history` - Historical messages

**Admin Sends:**

- `agent_message` - Send message to user
- `get_history` - Request chat history

## Environment Variables

```env
NEXT_PUBLIC_API_URL=https://indulgeconcierge.com/api
NEXT_PUBLIC_SOCKET_URL=https://indulgeconcierge.com
```

## Deployment

```bash
npm run build
npm start
```

Or deploy to Vercel:

```bash
vercel
```

## Support

Backend: https://indulgeconcierge.com
Docs: See WEBSOCKET_CHAT_INTEGRATION.md in backend repo

# Indulge_Help_Desk
