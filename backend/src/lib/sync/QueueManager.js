import EventEmitter from 'events';
import { logger } from '../../utils/logger.js';

/**
 * Queue item priorities
 */
export const Priority = {
  HIGH: 1,
  NORMAL: 2,
  LOW: 3
};

/**
 * Queue item statuses
 */
export const QueueItemStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying'
};

/**
 * Manages sync operation queues with prioritization and retry logic
 */
export class QueueManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.uploadQueue = [];
    this.downloadQueue = [];
    this.processingItems = new Set();
    
    // Configuration
    this.maxConcurrentOperations = options.maxConcurrentOperations || 3;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 1000;
    this.timeoutMs = options.timeoutMs || 30000; // 30 seconds
    
    // State
    this.isProcessing = false;
    this.stats = {
      totalQueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      totalRetries: 0
    };
    
    // Start processing
    this.startProcessing();
  }

  /**
   * Add an upload operation to the queue
   * @param {Object} fileData - File data to upload
   * @param {number} priority - Operation priority (1-3, 1 being highest)
   * @param {Object} options - Additional options
   * @returns {string} Queue item ID
   */
  queueUpload(fileData, priority = Priority.NORMAL, options = {}) {
    const item = this.createQueueItem({
      type: 'upload',
      fileData,
      priority,
      options,
      ...options
    });

    this.uploadQueue.push(item);
    this.sortQueue(this.uploadQueue);
    this.stats.totalQueued++;

    logger.info('Upload queued', {
      itemId: item.id,
      fileName: fileData.name,
      priority,
      queueSize: this.uploadQueue.length
    });

    this.emit('itemQueued', item);
    this.processNext();

    return item.id;
  }

  /**
   * Add a download operation to the queue
   * @param {Object} fileData - File data to download
   * @param {number} priority - Operation priority (1-3, 1 being highest)
   * @param {Object} options - Additional options
   * @returns {string} Queue item ID
   */
  queueDownload(fileData, priority = Priority.NORMAL, options = {}) {
    const item = this.createQueueItem({
      type: 'download',
      fileData,
      priority,
      options,
      ...options
    });

    this.downloadQueue.push(item);
    this.sortQueue(this.downloadQueue);
    this.stats.totalQueued++;

    logger.info('Download queued', {
      itemId: item.id,
      fileName: fileData.name,
      priority,
      queueSize: this.downloadQueue.length
    });

    this.emit('itemQueued', item);
    this.processNext();

    return item.id;
  }

  /**
   * Create a queue item with metadata
   * @param {Object} data - Item data
   * @returns {Object} Queue item
   */
  createQueueItem(data) {
    return {
      id: this.generateItemId(),
      ...data,
      status: QueueItemStatus.PENDING,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      timeoutId: null
    };
  }

  /**
   * Generate unique queue item ID
   * @returns {string} Unique ID
   */
  generateItemId() {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sort queue by priority (ascending - lower numbers = higher priority)
   * @param {Array} queue - Queue to sort
   */
  sortQueue(queue) {
    queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Start processing queues
   */
  startProcessing() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processNext();

    logger.info('Queue processing started', {
      maxConcurrentOperations: this.maxConcurrentOperations
    });
  }

  /**
   * Stop processing queues
   */
  stopProcessing() {
    this.isProcessing = false;
    
    // Clear timeouts for processing items
    this.processingItems.forEach(item => {
      if (item.timeoutId) {
        clearTimeout(item.timeoutId);
      }
    });

    logger.info('Queue processing stopped');
  }

  /**
   * Process next items in queue
   */
  async processNext() {
    if (!this.isProcessing || this.processingItems.size >= this.maxConcurrentOperations) {
      return;
    }

    // Get next item to process (prioritize uploads, then downloads)
    const nextItem = this.getNextQueueItem();
    if (!nextItem) {
      return;
    }

    // Remove from queue and add to processing set
    this.removeFromQueue(nextItem);
    this.processingItems.add(nextItem);

    // Update item status
    nextItem.status = QueueItemStatus.PROCESSING;
    nextItem.updatedAt = new Date();

    logger.info('Processing queue item', {
      itemId: nextItem.id,
      type: nextItem.type,
      fileName: nextItem.fileData.name
    });

    this.emit('itemProcessing', nextItem);

    try {
      // Set timeout for operation
      const timeoutPromise = new Promise((_, reject) => {
        nextItem.timeoutId = setTimeout(() => {
          reject(new Error(`Operation timeout after ${this.timeoutMs}ms`));
        }, this.timeoutMs);
      });

      // Process the item
      const operationPromise = this.executeOperation(nextItem);
      
      await Promise.race([operationPromise, timeoutPromise]);

      // Clear timeout
      if (nextItem.timeoutId) {
        clearTimeout(nextItem.timeoutId);
      }

      // Mark as completed
      nextItem.status = QueueItemStatus.COMPLETED;
      nextItem.updatedAt = new Date();
      this.stats.totalProcessed++;

      logger.info('Queue item completed', {
        itemId: nextItem.id,
        type: nextItem.type,
        fileName: nextItem.fileData.name
      });

      this.emit('itemCompleted', nextItem);

    } catch (error) {
      // Clear timeout
      if (nextItem.timeoutId) {
        clearTimeout(nextItem.timeoutId);
      }

      await this.handleOperationError(nextItem, error);
    }

    // Remove from processing set
    this.processingItems.delete(nextItem);

    // Continue processing
    setTimeout(() => this.processNext(), 100);
  }

  /**
   * Get the next item to process from queues
   * @returns {Object|null} Next queue item or null
   */
  getNextQueueItem() {
    // Prioritize uploads over downloads
    if (this.uploadQueue.length > 0) {
      return this.uploadQueue[0];
    }
    
    if (this.downloadQueue.length > 0) {
      return this.downloadQueue[0];
    }

    return null;
  }

  /**
   * Remove item from appropriate queue
   * @param {Object} item - Queue item to remove
   */
  removeFromQueue(item) {
    if (item.type === 'upload') {
      const index = this.uploadQueue.findIndex(qItem => qItem.id === item.id);
      if (index !== -1) {
        this.uploadQueue.splice(index, 1);
      }
    } else if (item.type === 'download') {
      const index = this.downloadQueue.findIndex(qItem => qItem.id === item.id);
      if (index !== -1) {
        this.downloadQueue.splice(index, 1);
      }
    }
  }

  /**
   * Execute the queue operation
   * @param {Object} item - Queue item to execute
   * @returns {Promise} Operation result
   */
  async executeOperation(item) {
    const { type, operation, fileData, options } = item;

    if (!operation || typeof operation !== 'function') {
      throw new Error(`No operation function provided for ${type} operation`);
    }

    // Execute the operation with the provided function
    return await operation(fileData, options);
  }

  /**
   * Handle operation error and retry logic
   * @param {Object} item - Failed queue item
   * @param {Error} error - Error that occurred
   */
  async handleOperationError(item, error) {
    item.retryCount++;
    item.lastError = error.message;
    this.stats.totalFailed++;

    logger.error('Queue item failed', {
      itemId: item.id,
      type: item.type,
      fileName: item.fileData.name,
      error: error.message,
      retryCount: item.retryCount
    });

    // Check if we should retry
    if (item.retryCount < this.maxRetries) {
      item.status = QueueItemStatus.RETRYING;
      this.stats.totalRetries++;

      logger.info('Retrying queue item', {
        itemId: item.id,
        retryCount: item.retryCount,
        maxRetries: this.maxRetries
      });

      // Add back to appropriate queue with delay
      setTimeout(() => {
        if (item.type === 'upload') {
          this.uploadQueue.push(item);
          this.sortQueue(this.uploadQueue);
        } else if (item.type === 'download') {
          this.downloadQueue.push(item);
          this.sortQueue(this.downloadQueue);
        }
        this.processNext();
      }, this.retryDelayMs * item.retryCount);

      this.emit('itemRetrying', item);
    } else {
      // Max retries reached
      item.status = QueueItemStatus.FAILED;
      item.updatedAt = new Date();

      logger.error('Queue item permanently failed', {
        itemId: item.id,
        type: item.type,
        fileName: item.fileData.name,
        retryCount: item.retryCount
      });

      this.emit('itemFailed', item);
    }
  }

  /**
   * Get queue status
   * @returns {Object} Queue status information
   */
  getStatus() {
    return {
      uploadQueue: {
        length: this.uploadQueue.length,
        items: this.uploadQueue.map(item => ({
          id: item.id,
          fileName: item.fileData.name,
          status: item.status,
          priority: item.priority,
          retryCount: item.retryCount,
          createdAt: item.createdAt
        }))
      },
      downloadQueue: {
        length: this.downloadQueue.length,
        items: this.downloadQueue.map(item => ({
          id: item.id,
          fileName: item.fileData.name,
          status: item.status,
          priority: item.priority,
          retryCount: item.retryCount,
          createdAt: item.createdAt
        }))
      },
      processing: {
        count: this.processingItems.size,
        items: Array.from(this.processingItems).map(item => ({
          id: item.id,
          fileName: item.fileData.name,
          type: item.type,
          status: item.status
        }))
      },
      stats: { ...this.stats },
      isProcessing: this.isProcessing
    };
  }

  /**
   * Clear all queues
   */
  clearQueues() {
    const uploadCount = this.uploadQueue.length;
    const downloadCount = this.downloadQueue.length;

    this.uploadQueue.length = 0;
    this.downloadQueue.length = 0;

    logger.info('Queues cleared', {
      uploadCount,
      downloadCount
    });

    this.emit('queuesCleared', { uploadCount, downloadCount });
  }

  /**
   * Remove specific item from queue
   * @param {string} itemId - Item ID to remove
   * @returns {boolean} True if item was removed
   */
  removeItem(itemId) {
    // Check upload queue
    let index = this.uploadQueue.findIndex(item => item.id === itemId);
    if (index !== -1) {
      const item = this.uploadQueue.splice(index, 1)[0];
      logger.info('Item removed from upload queue', { itemId });
      this.emit('itemRemoved', item);
      return true;
    }

    // Check download queue
    index = this.downloadQueue.findIndex(item => item.id === itemId);
    if (index !== -1) {
      const item = this.downloadQueue.splice(index, 1)[0];
      logger.info('Item removed from download queue', { itemId });
      this.emit('itemRemoved', item);
      return true;
    }

    // Check processing items
    for (const item of this.processingItems) {
      if (item.id === itemId) {
        if (item.timeoutId) {
          clearTimeout(item.timeoutId);
        }
        this.processingItems.delete(item);
        logger.info('Item removed from processing', { itemId });
        this.emit('itemRemoved', item);
        return true;
      }
    }

    return false;
  }

  /**
   * Update queue configuration
   * @param {Object} options - New configuration options
   */
  updateConfig(options) {
    if (options.maxConcurrentOperations !== undefined) {
      this.maxConcurrentOperations = options.maxConcurrentOperations;
    }
    if (options.maxRetries !== undefined) {
      this.maxRetries = options.maxRetries;
    }
    if (options.retryDelayMs !== undefined) {
      this.retryDelayMs = options.retryDelayMs;
    }
    if (options.timeoutMs !== undefined) {
      this.timeoutMs = options.timeoutMs;
    }

    logger.info('Queue configuration updated', {
      maxConcurrentOperations: this.maxConcurrentOperations,
      maxRetries: this.maxRetries,
      retryDelayMs: this.retryDelayMs,
      timeoutMs: this.timeoutMs
    });
  }

  /**
   * Get queue size for a specific project
   * @param {string} projectId - Project ID
   * @returns {number} Number of items in queue for this project
   */
  getQueueSize(projectId) {
    const uploadCount = this.uploadQueue.filter(item => item.metadata?.projectId === projectId).length;
    const downloadCount = this.downloadQueue.filter(item => item.metadata?.projectId === projectId).length;
    return uploadCount + downloadCount;
  }

  /**
   * Get total queue size across all projects
   * @returns {number} Total number of items in all queues
   */
  getTotalQueueSize() {
    return this.uploadQueue.length + this.downloadQueue.length;
  }

  /**
   * Get comprehensive queue status
   * @returns {Object} Detailed queue status
   */
  getQueueStatus() {
    return {
      upload: {
        pending: this.uploadQueue.filter(item => item.status === QueueItemStatus.PENDING).length,
        processing: this.uploadQueue.filter(item => item.status === QueueItemStatus.PROCESSING).length,
        total: this.uploadQueue.length
      },
      download: {
        pending: this.downloadQueue.filter(item => item.status === QueueItemStatus.PENDING).length,
        processing: this.downloadQueue.filter(item => item.status === QueueItemStatus.PROCESSING).length,
        total: this.downloadQueue.length
      },
      totalPending: this.uploadQueue.filter(item => item.status === QueueItemStatus.PENDING).length + 
                   this.downloadQueue.filter(item => item.status === QueueItemStatus.PENDING).length,
      totalProcessing: this.processingItems.size,
      isProcessing: this.isProcessing,
      maxConcurrentOperations: this.maxConcurrentOperations,
      stats: { ...this.stats }
    };
  }
}