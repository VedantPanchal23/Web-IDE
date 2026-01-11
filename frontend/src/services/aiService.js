import { apiService } from './api';

/**
 * AI Service Client
 * Handles all AI-related API calls
 */
class AIServiceClient {
  constructor() {
    this.isEnabled = true;
    this.provider = null;
    this.checkAvailability();
  }

  /**
   * Check if AI service is available
   */
  async checkAvailability() {
    try {
      const response = await apiService.get('/ai/status');
      if (response.data.success) {
        this.isEnabled = response.data.available;
        this.provider = response.data.provider;
        console.log(`🤖 AI Service: ${this.isEnabled ? 'Available' : 'Not configured'}`, {
          provider: this.provider
        });
        return response.data;
      }
    } catch (error) {
      console.warn('AI service check failed:', error);
      this.isEnabled = false;
    }
    return { available: false };
  }

  /**
   * Get code completion
   */
  async getCompletion({ code, cursorPosition, language, filePath, maxTokens = 200 }) {
    if (!this.isEnabled) {
      throw new Error('AI service not available');
    }

    try {
      const response = await apiService.post('/ai/complete', {
        code,
        cursorPosition,
        language,
        filePath,
        maxTokens
      });

      if (response.data.success) {
        return {
          completion: response.data.completion,
          provider: response.data.provider,
          isFree: response.data.isFree
        };
      }

      throw new Error(response.data.message || 'Completion failed');
    } catch (error) {
      console.error('AI completion failed:', error);
      throw error;
    }
  }

  /**
   * Explain code
   */
  async explainCode({ code, language, context }) {
    if (!this.isEnabled) {
      throw new Error('AI service not available');
    }

    try {
      const response = await apiService.post('/ai/explain', {
        code,
        language,
        context
      });

      if (response.data.success) {
        return {
          explanation: response.data.explanation,
          provider: response.data.provider
        };
      }

      throw new Error(response.data.message || 'Explanation failed');
    } catch (error) {
      console.error('Code explanation failed:', error);
      throw error;
    }
  }

  /**
   * Generate code from comment
   */
  async generateCode({ comment, language, context, filePath }) {
    if (!this.isEnabled) {
      throw new Error('AI service not available');
    }

    try {
      const response = await apiService.post('/ai/generate', {
        comment,
        language,
        context,
        filePath
      });

      if (response.data.success) {
        return {
          code: response.data.code,
          provider: response.data.provider
        };
      }

      throw new Error(response.data.message || 'Code generation failed');
    } catch (error) {
      console.error('Code generation failed:', error);
      throw error;
    }
  }

  /**
   * Get refactoring suggestions
   */
  async getRefactoringSuggestions({ code, language, context }) {
    if (!this.isEnabled) {
      throw new Error('AI service not available');
    }

    try {
      const response = await apiService.post('/ai/refactor', {
        code,
        language,
        context
      });

      if (response.data.success) {
        return {
          suggestions: response.data.suggestions,
          provider: response.data.provider
        };
      }

      throw new Error(response.data.message || 'Refactoring failed');
    } catch (error) {
      console.error('Refactoring failed:', error);
      throw error;
    }
  }

  /**
   * Chat with AI
   */
  async chat({ message, conversationHistory, codeContext }) {
    if (!this.isEnabled) {
      throw new Error('AI service not available');
    }

    try {
      const response = await apiService.post('/ai/chat', {
        message,
        conversationHistory,
        codeContext
      });

      if (response.data.success) {
        return {
          response: response.data.response,
          provider: response.data.provider
        };
      }

      throw new Error(response.data.message || 'Chat failed');
    } catch (error) {
      console.error('AI chat failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const aiServiceClient = new AIServiceClient();
export default aiServiceClient;
