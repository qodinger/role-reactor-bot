# Website Authentication Integration Guide

This guide details how to integrate your frontend website with the Role Reactor Bot's authentication system. The bot provides a complete OAuth2 flow that you can use to authenticate users on your dashboard or website.

## Overview

The authentication system uses Discord OAuth2. The flow is as follows:
1.  **Login**: User clicks "Login" on your site -> Redirects to Bot API.
2.  **Discord Auth**: Bot API redirects to Discord -> User authorizes.
3.  **Callback**: Discord redirects back to Bot API -> Bot verifies code & creates session.
4.  **Redirect**: Bot API redirects user back to your website (with a valid session cookie).
5.  **Verify**: Your website makes a request to `/auth/me` to get the logged-in user's info.

## API Endpoints

### 1. Initiate Login
**GET** `/auth/discord`

Redirect the user's browser to this endpoint to start the login process.

**Query Parameters:**
*   `redirect` (Optional): A relative URL path (e.g., `/dashboard`) to redirect the user to after successful login. Defaults to `/`.

### 2. Get Current User
**GET** `/auth/me`

Call this endpoint to check if the user is logged in and get their profile.

**Response (Success):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "123456789",
      "username": "username",
      "discriminator": "0",
      "avatar": "avatar_hash",
      "email": "user@example.com"
    }
  }
}
```

**Response (Not Logged In):**
```json
{
  "status": "error",
  "code": 401,
  "message": "Not authenticated"
}
```

### 3. Logout
**POST** `/auth/logout`

Call this endpoint to end the session.

**Response:**
```json
{
  "status": "success",
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## Implementation Examples

### Plain HTML/JavaScript

Here is a complete, minimal example using vanilla JavaScript.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Bot Authentication Demo</title>
</head>
<body>
    <div id="auth-section">
        <!-- Content injected by JS -->
        Loading...
    </div>

    <script>
        const API_URL = 'http://localhost:3030'; // Your Bot API URL

        // 1. Check Authentication Status on Page Load
        async function checkAuth() {
            try {
                // Important: 'credentials: include' sends the session cookie
                const response = await fetch(`${API_URL}/auth/me`, {
                    credentials: 'include' 
                });

                if (response.ok) {
                    const data = await response.json();
                    showLoggedIn(data.data.user);
                } else {
                    showLoginButton();
                }
            } catch (error) {
                console.error("Auth check failed:", error);
                showLoginButton();
            }
        }

        // 2. Render Login Button
        function showLoginButton() {
            const container = document.getElementById('auth-section');
            // Redirect to the bot's auth endpoint
            // You can add ?redirect=/dashboard to specify where to go after login
            container.innerHTML = `
                <button onclick="window.location.href='${API_URL}/auth/discord?redirect=/'">
                    Login with Discord
                </button>
            `;
        }

        // 3. Render Logged In State
        function showLoggedIn(user) {
            const container = document.getElementById('auth-section');
            const avatarUrl = user.avatar 
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
                : 'https://cdn.discordapp.com/embed/avatars/0.png';

            container.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${avatarUrl}" style="width: 40px; border-radius: 50%;">
                    <span>Welcome, <strong>${user.username}</strong>!</span>
                    <button onclick="logout()">Logout</button>
                </div>
            `;
        }

        // 4. Handle Logout
        async function logout() {
            try {
                await fetch(`${API_URL}/auth/logout`, {
                    method: 'POST',
                    credentials: 'include'
                });
                window.location.reload();
            } catch (error) {
                console.error("Logout failed:", error);
            }
        }

        // Initialize
        checkAuth();
    </script>
</body>
</html>
```

### React / Next.js

For React, you typically use a hook or context to manage authentication state.

```jsx
import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3030';

export default function AuthComponent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth on mount
    fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => setUser(data.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = () => {
    // Redirect browser to backend auth endpoint
    window.location.href = `${API_URL}/auth/discord?redirect=${window.location.pathname}`;
  };

  const handleLogout = async () => {
    await fetch(`${API_URL}/auth/logout`, { 
      method: 'POST', 
      credentials: 'include' 
    });
    setUser(null);
  };

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return (
      <button onClick={handleLogin} className="btn-discord">
        Login with Discord
      </button>
    );
  }

  return (
    <div className="user-profile">
      <img 
        src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} 
        alt={user.username} 
      />
      <span>{user.username}</span>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
```

## CORS Configuration

If your frontend is on a different domain/port than the bot (e.g., frontend on `localhost:3000`, bot on `localhost:3030`), you need to ensure CORS is configured correctly in the bot.

In `src/server/middleware/cors.js`, ensure the `allowedOrigins` includes your frontend URL:

```javascript
const allowedOrigins = [
  "http://localhost:3000", // Add your frontend URL
  "https://your-production-site.com"
];
```

And in your frontend `fetch` calls, **always** include `credentials: 'include'` to allow cookies to be sent and received across origins.
