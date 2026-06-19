# Remote Control Feature Documentation

## Overview

The remote control feature allows meeting participants to request control over another participant's screen, similar to Zoom's remote control functionality. The controller can move the mouse, click, type, and scroll on the controlled participant's screen.

## Features Implemented

### 1. Remote Control Request Model (`models/RemoteControlRequest.ts`)
- Stores remote control requests with:
  - Requester and target user information
  - Meeting and room context
  - Status tracking (pending, accepted, declined, expired)
  - 5-minute expiration for pending requests
  - Timestamps for user actions (respondedAt, respondedBy)

### 2. REST API Endpoints

#### Request Remote Control
**POST** `/api/meetings/[meetingId]/remote-control/request`
```json
{
  "requestedUserId": "user-id",
  "requestedUserName": "User Name",
  "requestedUserEmail": "user@example.com",
  "roomId": "room-id"
}
```
- Creates a new remote control request
- Prevents duplicate pending requests to the same user
- Returns request ID and expiration time

#### Allow Remote Control
**POST** `/api/meetings/[meetingId]/remote-control/allow`
```json
{
  "requestId": "request-id"
}
```
- Updates request status to "accepted"
- Only the requested user can allow
- Checks for expired requests

#### Decline Remote Control
**POST** `/api/meetings/[meetingId]/remote-control/decline`
```json
{
  "requestId": "request-id"
}
```
- Updates request status to "declined"
- Only the requested user can decline

#### Revoke Remote Control
**POST** `/api/meetings/[meetingId]/remote-control/revoke`
```json
{
  "requestId": "request-id"
}
```
- Stops an active remote control session
- Can be called by either the controller or controlled user

#### Get Remote Control Status
**GET** `/api/meetings/[meetingId]/remote-control/status`
- Returns all pending requests for the user
- Returns all active sessions where user is the controller
- Auto-cleans up expired requests

### 3. UI Components

#### RemoteControlPanel (`components/RemoteControlPanel.tsx`)
- Modal dialog that appears when a user receives a remote control request
- Displays the requester's name and email
- Shows Clear warning about what remote control allows
- Provides "Allow" and "Decline" buttons
- Error handling and loading states

#### RemoteControlManager (`components/RemoteControlManager.tsx`)
- Button to request remote control from other participants
- Dropdown menu showing:
  - List of all participants in the meeting
  - Status indicators (Pending shows current requests)
  - Active sessions with Stop button
- Polls for status updates every 5 seconds
- Handles request sending and session revocation

### 4. Utility Library (`lib/remote-control.ts`)

#### Event Types
- `MouseMoveEvent`: Track cursor position
- `MouseClickEvent`: Left/middle/right clicks with click count
- `KeyPressEvent`: Keyboard input with modifier keys
- `ScrollEvent`: Scroll actions with delta values
- `ScreenCaptureEvent`: Screen capture data

#### Remote Control Classes

**RemoteControlMouseTracker**
- Tracks mouse movements and clicks
- Detects double-clicks
- Emits events through callback

**RemoteControlKeyboardTracker**
- Captures keyboard input
- Tracks modifier keys (Ctrl, Shift, Alt)
- Skips standalone modifier keys

**RemoteControlEventSimulator**
- Shows remote cursor indicator on controlled screen
- Simulates mouse events on target elements
- Simulates keyboard events
- Simulates scroll events
- Creates a visual indicator showing remote cursor position

### 5. CoreMeetBridgeClient Integration

**Added Features:**
- Polling for incoming remote control requests (every 5 seconds)
- RemoteControlPanel modal when a request is pending
- RemoteControlManager button in the top-left of the meeting
- Participant list extraction from room occupants
- Request allow/decline/revoke handlers

## User Flow

### Requesting Remote Control
1. User clicks the "Remote Control" button in top-left of meeting
2. Dropdown menu appears showing all participants
3. User clicks on a participant name
4. Request is sent to that participant
5. Button shows "Pending" status for that user

### Receiving Remote Control Request
1. User receives a notification in the form of a modal dialog
2. Modal shows who is requesting control and what they can do
3. User can click "Allow" or "Decline"
4. Allowed session starts immediately
5. User can revoke at any time via Remote Control menu

### Active Remote Control Session
1. Controller sees the session listed under "Active Sessions"
2. Controller's mouse movements appear as a blue circle on controlled screen
3. Controller can move mouse, click, type, and scroll
4. Either user can click "Stop" to end the session
5. Session is automatically visible to all parties

## Security Considerations

- Only authenticated users can request remote control
- Requests are tied to specific meetings and rooms
- Requests expire after 5 minutes if not responded to
- Only the target user can accept/decline
- Either party can revoke an active session
- Tenant isolation ensures requests don't cross tenants

## Database Indexes

RemoteControlRequest table has indexes on:
- `tenantId`, `meetingId`, `roomId`, `status` (composite)
- `requestedBy.userId`
- `requestedUser.userId`

This enables fast lookups for users' incoming and outgoing requests.

## Future Enhancement Opportunities

1. **WebRTC Data Channels**: Use WebRTC for lower-latency event transmission instead of HTTP polling
2. **Screen Sharing**: Show the controlled screen to the controller
3. **Permission Granularity**: Allow users to enable/disable specific capabilities (mouse only, keyboard only, etc.)
4. **Request Queue**: Instead of one pending request, queue multiple requests
5. **Notifications**: Toast/notification system for better UX
6. **Analytics**: Track remote control usage for security audits
7. **Multi-participant Control**: Allow multiple controllers with different permissions
8. **Recording**: Include remote control events in meeting replays

## Testing Checklist

- [ ] Request remote control from another participant
- [ ] Receive and allow a remote control request
- [ ] Receive and decline a remote control request
- [ ] Mouse movements appear correctly on controlled screen
- [ ] Clicks work on buttons and interactive elements
- [ ] Keyboard input works in text fields
- [ ] Scrolling works on both axes
- [ ] Revoke session and verify control stops
- [ ] Request expires after 5 minutes
- [ ] Participant can revoke their own session
- [ ] Controller can revoke from Active Sessions list
- [ ] UI updates correctly when accepting/declining
- [ ] No duplicate requests to same user
- [ ] Works with breakout rooms
- [ ] Tenant isolation is maintained
