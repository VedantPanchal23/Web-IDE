import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    picture: {
      type: String,
      default: null
    },
    verified_email: {
      type: Boolean,
      default: false
    },
    
    // Google Drive integration (flattened to avoid path collisions)
    driveAccessToken: { type: String, select: false },
    driveRefreshToken: { type: String, select: false },
    driveTokenType: { type: String, default: 'Bearer' },
    driveTokenExpiresAt: { type: Date },
    
    // AI-IDE specific data
    driveProjectsFolderId: {
      type: String,
      default: null
    },
    
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'dark'
      },
      fontSize: {
        type: Number,
        min: 10,
        max: 24,
        default: 14
      },
      language: {
        type: String,
        default: 'en'
      },
      defaultLanguage: {
        type: String,
        enum: ['javascript', 'python', 'typescript', 'go', 'rust'],
        default: 'javascript'
      }
    },
    
    // Usage tracking
    lastLoginAt: {
      type: Date,
      default: Date.now
    },
    lastActiveAt: {
      type: Date,
      default: Date.now
    },
    loginCount: {
      type: Number,
      default: 1
    },
    
    // Account status
    isActive: {
      type: Boolean,
      default: true
    },
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.driveAccessToken;
        delete ret.driveRefreshToken;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.driveAccessToken;
        delete ret.driveRefreshToken;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Indexes for performance
// Note: googleId and email indexes are automatically created due to unique: true
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Instance methods
userSchema.methods.updateActivity = function () {
  this.lastActiveAt = new Date();
  this.loginCount += 1;
  return this.save();
};

userSchema.methods.updateDriveTokens = function (tokens) {
  console.log('updateDriveTokens called with:', {
    hasAccessToken: !!tokens.access_token,
    hasRefreshToken: !!tokens.refresh_token,
    userId: this._id
  });
  this.driveAccessToken = tokens.access_token;
  this.driveRefreshToken = tokens.refresh_token;
  this.driveTokenType = tokens.token_type || 'Bearer';
  this.driveTokenExpiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
  return this.save();
};

userSchema.methods.isTokenExpired = function () {
  if (!this.driveTokenExpiresAt) {
    return true;
  }
  return new Date() >= this.driveTokenExpiresAt;
};

// Static methods
userSchema.statics.findByGoogleId = function (googleId) {
  return this.findOne({ googleId, isActive: true });
};

userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

userSchema.statics.createFromGoogle = function (googleProfile, tokens) {
  const userData = {
    googleId: googleProfile.id,
    email: googleProfile.email,
    name: googleProfile.name,
    picture: googleProfile.picture,
    verified_email: googleProfile.verified_email,
    driveAccessToken: tokens.access_token || null,
    driveRefreshToken: tokens.refresh_token || null,
    driveTokenType: tokens.token_type || 'Bearer',
    driveTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    isVerified: googleProfile.verified_email || false
  };

  return this.create(userData);
};

// Pre-save middleware
userSchema.pre('save', function (next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase();
  }
  next();
});

export const User = mongoose.model('User', userSchema);