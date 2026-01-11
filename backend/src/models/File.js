import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255
    },
    path: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['file', 'folder'],
      required: true
    },
    extension: {
      type: String,
      lowercase: true
    },
    content: {
      type: String,
      default: ''
    },
    size: {
      type: Number,
      default: 0
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      default: null
    },
    driveId: {
      type: String,
      required: false, // Optional - files may not be synced to Drive yet
      unique: true,
      sparse: true // Allow multiple null values
    },
    mimeType: {
      type: String,
      default: 'text/plain'
    },
    encoding: {
      type: String,
      default: 'utf8'
    },
    isReadonly: {
      type: Boolean,
      default: false
    },
    syncStatus: {
      type: String,
      enum: ['synced', 'syncing', 'pending', 'conflict', 'local-only', 'drive-only', 'error'],
      default: 'synced'
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now
    },
    localHash: {
      type: String,
      default: null
    },
    driveHash: {
      type: String,
      default: null
    },
    conflictData: {
      localContent: String,
      driveContent: String,
      conflictedAt: Date
    },
    metadata: {
      language: {
        type: String,
        default: 'plaintext'
      },
      lineCount: {
        type: Number,
        default: 0
      },
      characterCount: {
        type: Number,
        default: 0
      },
      lastEditedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      version: {
        type: Number,
        default: 1
      },
      isGenerated: {
        type: Boolean,
        default: false
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
fileSchema.index({ project: 1, path: 1 });
fileSchema.index({ parent: 1 });
// Note: driveId index is automatically created due to unique: true
fileSchema.index({ syncStatus: 1 });
fileSchema.index({ project: 1, type: 1 });
fileSchema.index({ name: 'text', path: 'text' });

// Compound index for file tree queries
fileSchema.index({ project: 1, parent: 1, name: 1 });

// Virtual for children (for folder types)
fileSchema.virtual('children', {
  ref: 'File',
  localField: '_id',
  foreignField: 'parent'
});

// Pre-save middleware to set extension and detect language
fileSchema.pre('save', function (next) {
  if (this.type === 'file' && this.name.includes('.')) {
    this.extension = this.name.split('.').pop().toLowerCase();
    
    // Auto-detect language from extension
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'json': 'json',
      'md': 'markdown',
      'txt': 'plaintext',
      'xml': 'xml',
      'yml': 'yaml',
      'yaml': 'yaml',
      'sh': 'shell',
      'bash': 'shell',
      'sql': 'sql',
      'php': 'php',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby'
    };
    
    this.metadata.language = languageMap[this.extension] || 'plaintext';
  }
  
  // Update content metrics
  if (this.content) {
    this.size = Buffer.byteLength(this.content, 'utf8');
    this.metadata.characterCount = this.content.length;
    this.metadata.lineCount = this.content.split('\n').length;
  }
  
  next();
});

// Static method to get file tree for a project
fileSchema.statics.getFileTree = async function (projectId, rootId = null) {
  const files = await this.find({ 
    project: projectId, 
    parent: rootId 
  })
  .sort({ type: 1, name: 1 }) // Folders first, then files, both alphabetically
  .lean();
  
  // Transform and recursively get children for folders
  for (const file of files) {
    // Transform _id to id for frontend compatibility
    file.id = file._id.toString();
    
    if (file.type === 'folder') {
      file.children = await this.getFileTree(projectId, file._id);
    }
  }
  
  return files;
};

// Static method to get full path
fileSchema.statics.getFullPath = async function (fileId) {
  const file = await this.findById(fileId);
  if (!file) return null;
  
  let path = file.name;
  let currentFile = file;
  
  while (currentFile.parent) {
    currentFile = await this.findById(currentFile.parent);
    if (currentFile) {
      path = `${currentFile.name}/${path}`;
    }
  }
  
  return path;
};

// Instance method to update sync status
fileSchema.methods.updateSyncStatus = function (status, additionalData = {}) {
  this.syncStatus = status;
  this.lastSyncedAt = new Date();
  
  if (additionalData.localHash) this.localHash = additionalData.localHash;
  if (additionalData.driveHash) this.driveHash = additionalData.driveHash;
  if (additionalData.conflictData) this.conflictData = additionalData.conflictData;
  
  return this.save();
};

export const File = mongoose.model('File', fileSchema);