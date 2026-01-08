# Customer Support System API Documentation

## 1. Authentication Module

The Authentication module handles user registration, login, email verification, and token management.

### Endpoints

#### **Signup**
- **URL**: `/api/auth/singup`
- **Method**: `POST`
- **Description**: Registers a new user. Default user type is 'customer'.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "confirmPassword": "Password123!",
    "usertype": "customer" // Optional: "customer" or "admin"
  }
  ```
- **Response** (Success):
  ```json
  {
    "success": true,
    "message": "User created successfully. Please check your email for verification link.",
    "data": {
      "id": "uuid",
      "email": "user@example.com",
      "isVerified": false,
      "userType": "customer"
    }
  }
  ```

#### **Login**
- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Description**: Authenticates a user and returns JWT tokens.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Response** (Success):
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "accessToken": "jwt_token",
      "refreshToken": "refresh_token",
      "tokenType": "Bearer",
      "expiresIn": "1h",
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "isVerified": true,
        "lastLogin": "timestamp"
      }
    }
  }
  ```

#### **Verify Email**
- **URL**: `/api/auth/verify-email?token={verificationToken}`
- **Method**: `GET`
- **Description**: Verifies a user's email address using a token.

#### **Refresh Token**
- **URL**: `/api/auth/refresh-token`
- **Method**: `POST`
- **Description**: Generates a new access token using a valid refresh token.
- **Request Body**:
  ```json
  {
    "refreshToken": "refresh_token"
  }
  ```

#### **Logout**
- **URL**: `/api/auth/logout`
- **Method**: `POST`
- **Description**: Revokes the refresh token and logs out the user.
- **Auth Required**: Yes

#### **Get Current User**
- **URL**: `/api/auth/me`
- **Method**: `GET`
- **Description**: Returns details of the currently authenticated user.
- **Auth Required**: Yes

---

## 2. Chat Module

The Chat module manages real-time communication between customers and support admins.

### Endpoints

#### **Get My Room**
- **URL**: `/api/chat/my-room`
- **Method**: `GET`
- **Description**: Retrieves or creates a chat room for the authenticated customer.
- **Auth Required**: Yes

#### **Get Chat History**
- **URL**: `/api/chat/history/:roomId`
- **Method**: `GET`
- **Query Params**: `limit` (default 100), `offset` (default 0)
- **Description**: Fetches message history for a specific room.
- **Auth Required**: Yes (Participant or Admin only)

#### **Mark Messages as Read**
- **URL**: `/api/chat/messages/read`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "messageIds": ["uuid1", "uuid2"]
  }
  ```
- **Description**: Marks specific messages as read by the receiver.
- **Auth Required**: Yes

#### **Clear Chat History**
- **URL**: `/api/chat/clear/:roomId`
- **Method**: `POST`
- **Description**: Hides chat history for the user from a specific room.
- **Auth Required**: Yes

#### **Get Unread Count**
- **URL**: `/api/chat/unread-count`
- **Method**: `GET`
- **Description**: Returns the count of unread messages for the user.
- **Auth Required**: Yes

#### **Get All Chat Rooms (Admin Only)**
- **URL**: `/api/chat/admin/rooms`
- **Method**: `GET`
- **Description**: Lists all active chat rooms for support management.
- **Auth Required**: Yes (Admin only)

---

## 3. Real-time Communication (Socket.io)

### Connection
- **URL**: `ws://your-server-url`
- **Authentication**: Pass token in `auth` object or `Authorization` header.

### Events (Client to Server)
- `send_message`: `{ receiverId, message, messageType, roomId }`
- `typing`: `{ roomId, isTyping }`
- `mark_as_read`: `{ messageIds, roomId }`
- `clear_chat`: `(no data)`
- `join_room`: `roomId` (Admin only)

### Events (Server to Client)
- `receive_message`: New message notification.
- `user_typing`: Typing status updates.
- `message_sent`: Confirmation of sent message.
- `message_read`: Notification when a message is read.
- `admin_online`: Status of support availability.
- `customer_connected`: (Admin only) New customer alert.
