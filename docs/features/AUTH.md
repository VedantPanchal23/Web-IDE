# 🔐 Authentication & Security

## Overview
Secure user authentication using Google OAuth2, JWT tokens, session management, and comprehensive security measures for enterprise-grade protection.

---

## ✨ Key Features

### 1. **Google OAuth2**
- Secure third-party authentication
- No password storage required
- Single Sign-On (SSO)
- Token-based sessions

### 2. **JWT Authentication**
- Stateless authentication
- Token expiration
- Refresh token support
- Secure token storage

### 3. **Session Management**
- Persistent sessions
- Auto-logout on expiry
- Multiple device support
- Session revocation

### 4. **Security Headers**
- CORS protection
- CSRF prevention
- XSS protection
- Helmet.js integration

---

## 🎯 Authentication Flow

### Login Process
```
┌─────────────────┐
│  User clicks    │
│ "Login Google"  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Redirect to     │
│ Google OAuth    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ User Authorizes │
│  Permissions    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Callback with   │
│   Auth Code     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Exchange Code   │
│  for Tokens     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Create User     │
│  in Database    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Generate JWT    │
│    Token        │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Store in        │
│  HttpOnly       │
│   Cookie        │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Redirect to     │
│      IDE        │
└─────────────────┘
```

---

## 🔧 Technical Details

### Components
```
backend/src/controllers/auth.controller.js   # OAuth handlers
backend/src/middleware/auth.middleware.js    # JWT verification
backend/src/models/User.js                   # User schema
backend/src/utils/jwt.js                     # Token generation
frontend/src/services/authService.js         # Auth client
frontend/src/contexts/AuthContext.jsx        # Auth state
```

### JWT Token Structure
```javascript
{
  // Header
  "alg": "HS256",
  "typ": "JWT",
  
  // Payload
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "name": "John Doe",
  "iat": 1699527600,  // Issued at
  "exp": 1699614000   // Expires (24 hours)
}
```

### API Endpoints
```javascript
// Authentication
GET  /auth/google              # Initiate OAuth
GET  /auth/google/callback     # OAuth callback
POST /auth/logout              # Sign out
GET  /auth/me                  # Get current user
POST /auth/refresh             # Refresh token

// Protected routes (require JWT)
GET  /api/v1/projects          # Needs auth
POST /api/v1/files             # Needs auth
```

---

## 🚀 Implementation Details

### 1. OAuth2 Configuration
```javascript
// backend/src/controllers/auth.controller.js
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.file'
  ],
  prompt: 'consent'
});
```

### 2. JWT Generation
```javascript
// backend/src/utils/jwt.js
function generateToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '24h',
      issuer: 'ai-ide',
      audience: 'ai-ide-users'
    }
  );
}
```

### 3. Token Verification Middleware
```javascript
// backend/src/middleware/auth.middleware.js
async function authenticateToken(req, res, next) {
  try {
    // Extract token from cookie or header
    const token = req.cookies.token || 
                  req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user to request
    req.user = await User.findById(decoded.userId);
    
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    res.status(403).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
}
```

### 4. Frontend Auth Context
```javascript
// frontend/src/contexts/AuthContext.jsx
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check if user is logged in
    checkAuth();
  }, []);
  
  async function checkAuth() {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }
  
  async function login() {
    window.location.href = '/auth/google';
  }
  
  async function logout() {
    await api.post('/auth/logout');
    setUser(null);
    window.location.href = '/';
  }
  
  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## 🔒 Security Measures

### 1. Token Security
```javascript
// HttpOnly cookies (prevent XSS)
res.cookie('token', jwtToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
});

// Encrypted token storage in DB
const encryptedToken = crypto.encrypt(refreshToken, SECRET_KEY);
```

### 2. CORS Configuration
```javascript
// backend/src/index.js
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 3. Rate Limiting
```javascript
// backend/src/middleware/rateLimiter.js
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);
```

### 4. Security Headers (Helmet)
```javascript
// backend/src/index.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 5. Input Validation
```javascript
// Using express-validator
const { body, validationResult } = require('express-validator');

app.post('/api/v1/files',
  authenticateToken,
  [
    body('filename').trim().notEmpty().escape(),
    body('content').trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Process request
  }
);
```

---

## ⚙️ Configuration

### Environment Variables
```env
# backend/.env
JWT_SECRET=your_very_secure_random_secret_key_here
SESSION_SECRET=another_random_secret_for_sessions

GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

# Token expiration
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# Security
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

---

## 📊 User Schema

```javascript
// backend/src/models/User.js
const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true
  },
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  avatar: String,
  refreshToken: {
    type: String,
    select: false // Don't return in queries
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
```

---

## 🐛 Troubleshooting

### Issue: Token expired
**Solution**:
```javascript
// Implement token refresh
if (error.response?.status === 401) {
  const newToken = await refreshAccessToken();
  // Retry original request with new token
}
```

### Issue: CORS errors
**Solution**:
```javascript
// Check CORS configuration
// Ensure FRONTEND_URL matches exactly
// Include credentials: true in fetch
fetch(url, {
  credentials: 'include'
});
```

### Issue: OAuth callback fails
**Solution**:
```bash
# Verify redirect URI in Google Console
# Must match EXACTLY (including http/https, port)
http://localhost:3001/auth/google/callback

# Check OAuth credentials
cat backend/.env | grep GOOGLE
```

---

## 📖 References

- [Google OAuth2 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Security Cheat Sheet](https://cheatsheetseries.owasp.org/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
