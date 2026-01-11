import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      maxlength: 500,
      default: ''
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    driveId: {
      type: String,
      required: true,
      unique: true
    },
    driveFolderId: {
      type: String,
      required: true
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    programmingLanguage: {
      type: String,
      default: 'javascript'
    },
    framework: {
      type: String,
      default: null
    },
    lastAccessed: {
      type: Date,
      default: Date.now
    },
    syncStatus: {
      type: String,
      enum: ['synced', 'syncing', 'conflict', 'offline', 'error'],
      default: 'synced'
    },
    fileCount: {
      type: Number,
      default: 0
    },
    size: {
      type: Number,
      default: 0 // Size in bytes
    },
    collaborators: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        role: {
          type: String,
          enum: ['viewer', 'editor', 'admin'],
          default: 'viewer'
        },
        addedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    settings: {
      theme: {
        type: String,
        default: 'vs-dark'
      },
      fontSize: {
        type: Number,
        default: 14
      },
      tabSize: {
        type: Number,
        default: 2
      },
      autoSave: {
        type: Boolean,
        default: true
      }
    },
    metadata: {
      createdFrom: {
        type: String,
        enum: ['template', 'import', 'scratch'],
        default: 'scratch'
      },
      template: {
        type: String,
        default: null
      },
      tags: [String],
      version: {
        type: String,
        default: '1.0.0'
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
projectSchema.index({ owner: 1, createdAt: -1 });
// Note: driveId index is automatically created due to unique: true
projectSchema.index({ name: 'text', description: 'text' });
projectSchema.index({ lastAccessed: -1 });

// Virtual for file count (will be populated from File model)
projectSchema.virtual('files', {
  ref: 'File',
  localField: '_id',
  foreignField: 'project'
});

// Update lastAccessed when project is accessed
projectSchema.methods.updateLastAccessed = function () {
  this.lastAccessed = new Date();
  return this.save();
};

// Static method to find user projects
projectSchema.statics.findByUser = function (userId, options = {}) {
  const query = this.find({ owner: userId });
  
  if (options.limit) query.limit(options.limit);
  if (options.sort) query.sort(options.sort);
  else query.sort({ lastAccessed: -1 });
  
  return query.populate('files');
};

export const Project = mongoose.model('Project', projectSchema);