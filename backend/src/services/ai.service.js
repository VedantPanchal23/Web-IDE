import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

/**
 * AI Service
 * Provides code completion, explanation, and refactoring using Groq (FREE & FAST)
 */
class AIService {
  constructor() {
    this.groqUrl = 'https://api.groq.com/openai/v1';
    this.defaultProvider = 'groq';
    this.model = 'llama-3.3-70b-versatile'; // Groq's latest fast model (Nov 2024)
    this._initialized = false;
  }
  
  /**
   * Get Groq API key (read dynamically to ensure env vars are loaded)
   */
  get groqApiKey() {
    return process.env.GROQ_API_KEY || null;
  }

  /**
   * Initialize AI client (called lazily on first use)
   */
  async initialize() {
    if (this._initialized) return;
    this._initialized = true;
    
    logger.info(`🔍 Checking for Groq API key... ${this.groqApiKey ? 'FOUND' : 'NOT FOUND'}`);
    
    if (this.groqApiKey) {
      logger.info('✅ AI Service initialized with: groq (FREE tier)');
    } else {
      logger.warn(`
🤖 Groq API key not configured. Setup instructions:

1. Sign up at https://console.groq.com/
2. Get free API key from https://console.groq.com/keys
3. Add to backend/.env: GROQ_API_KEY=gsk_your_key_here
4. Restart backend server
      `);
    }
  }

  /**
   * Check if AI service is available
   */
  isAvailable() {
    return !!this.groqApiKey;
  }

  /**
   * Get code completion suggestion
   */
  async getCodeCompletion({ 
    code, 
    cursorPosition, 
    language, 
    filePath,
    maxTokens = 200
  }) {
    await this.initialize(); // Ensure initialized
    
    if (!this.isAvailable()) {
      throw new Error('Groq API key not configured');
    }

    const prompt = this.buildCompletionPrompt(code, cursorPosition, language, filePath);

    try {
      const response = await fetch(`${this.groqUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `You are an expert ${language} programmer. Complete the code at the cursor position. Only provide the completion, no explanations.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: maxTokens,
          top_p: 0.95
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Groq API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        logger.error('Invalid Groq response structure:', data);
        throw new Error('Invalid response from Groq API');
      }
      
      const completion = data.choices[0].message.content?.trim() || '';

      return {
        success: true,
        completion,
        provider: 'groq',
        model: this.model,
        isFree: true
      };
    } catch (error) {
      logger.error('Groq completion failed:', error.message);
      throw new Error(`AI completion failed: ${error.message}`);
    }
  }

  /**
   * Build prompt for code completion
   */
  buildCompletionPrompt(code, cursorPosition, language, filePath) {
    const beforeCursor = code.substring(0, cursorPosition);
    const afterCursor = code.substring(cursorPosition);
    
    return `Complete this ${language} code:\n\n${beforeCursor}[CURSOR]${afterCursor}\n\nProvide only the code that should replace [CURSOR]:`;
  }

  /**
   * Explain selected code
   */
  async explainCode({ code, language, context = '' }) {
    await this.initialize(); // Ensure initialized
    
    if (!this.isAvailable()) {
      throw new Error('Groq API key not configured');
    }

    const prompt = `Explain this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide: 1) What it does, 2) Key logic, 3) Potential improvements`;

    const response = await fetch(`${this.groqUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an expert programming assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Groq API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      explanation: data.choices[0].message.content,
      provider: 'groq',
      isFree: true
    };
  }

  /**
   * Generate code from comment/description
   */
  async generateCodeFromComment({ comment, language, context = '', filePath = '' }) {
    await this.initialize(); // Ensure initialized
    
    if (!this.isAvailable()) {
      throw new Error('Groq API key not configured');
    }

    const prompt = `Generate ${language} code for: ${comment}\n\nProvide clean, working code with comments. Code only, no explanations.`;

    const response = await fetch(`${this.groqUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: `You are a ${language} code generator. Output only code, no explanations.` },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Groq API error: ${response.statusText}`);
    }

    const data = await response.json();
    let code = data.choices[0].message.content.trim();
    code = code.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '');

    return {
      success: true,
      code,
      provider: 'groq',
      isFree: true
    };
  }

  /**
   * Get refactoring suggestions
   */
  async getRefactoringSuggestions({ code, language, context = '' }) {
    await this.initialize(); // Ensure initialized
    
    if (!this.isAvailable()) {
      throw new Error('Groq API key not configured');
    }

    const prompt = `Analyze this ${language} code and suggest 3 refactorings:\n\`\`\`${language}\n${code}\n\`\`\`\n\nFormat: **[Type]**: description\n\`\`\`code\`\`\`\nWhy: explanation`;

    const response = await fetch(`${this.groqUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an expert code reviewer providing refactoring suggestions.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.6
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Groq API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      suggestions: data.choices[0].message.content,
      provider: 'groq',
      isFree: true
    };
  }

  /**
   * Chat with AI about code
   */
  async chat({ message, conversationHistory = [], codeContext = null }) {
    await this.initialize(); // Ensure initialized
    
    if (!this.isAvailable()) {
      throw new Error('Groq API key not configured');
    }

    let fullPrompt = message;
    
    if (codeContext) {
      fullPrompt = `Context - File: ${codeContext.filePath}, Language: ${codeContext.language}\n\`\`\`${codeContext.language}\n${codeContext.code}\n\`\`\`\n\nQuestion: ${message}`;
    }

    const messages = [
      { role: 'system', content: 'You are an expert programming assistant. Help with code questions clearly and concisely.' },
      ...conversationHistory.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: fullPrompt }
    ];

    const response = await fetch(`${this.groqUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      logger.error('Groq API error:', { status: response.status, error });
      throw new Error(error.error?.message || `Groq API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      logger.error('Invalid Groq response structure:', data);
      throw new Error('Invalid response from Groq API');
    }

    return {
      success: true,
      response: data.choices[0].message.content,
      provider: 'groq',
      isFree: true
    };
  }
}

export default new AIService();

