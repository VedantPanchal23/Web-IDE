import React, { useState, useEffect } from 'react';
import { VscClose, VscCheck } from 'react-icons/vsc';
import './SettingsPanel.css';

const SettingsPanel = ({ isOpen, onClose, theme, setTheme, fontSize, setFontSize, fontFamily, setFontFamily }) => {
  const [activeTab, setActiveTab] = useState('appearance');

  // Available themes
  const themes = [
    { id: 'dark', name: 'Dark', description: 'VS Code Dark Theme' },
    { id: 'light', name: 'Light', description: 'VS Code Light Theme' },
  ];

  // Available fonts
  const fonts = [
    { id: 'jetbrains', name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
    { id: 'fira', name: 'Fira Code', family: "'Fira Code', monospace" },
    { id: 'cascadia', name: 'Cascadia Code', family: "'Cascadia Code', monospace" },
    { id: 'consolas', name: 'Consolas', family: "'Consolas', monospace" },
    { id: 'monaco', name: 'Monaco', family: "'Monaco', monospace" },
    { id: 'menlo', name: 'Menlo', family: "'Menlo', monospace" },
    { id: 'courier', name: 'Courier New', family: "'Courier New', monospace" },
    { id: 'ubuntu', name: 'Ubuntu Mono', family: "'Ubuntu Mono', monospace" },
  ];

  // Font sizes
  const fontSizes = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24];

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close-btn" onClick={onClose} title="Close (Esc)">
            <VscClose />
          </button>
        </div>

        {/* Tabs */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            Appearance
          </button>
          <button
            className={`settings-tab ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            Editor
          </button>
        </div>

        {/* Content */}
        <div className="settings-content">
          {activeTab === 'appearance' && (
            <div className="settings-section">
              <h3>Color Theme</h3>
              <p className="settings-description">Select your preferred color theme</p>
              
              <div className="theme-grid">
                {themes.map((themeOption) => (
                  <div
                    key={themeOption.id}
                    className={`theme-card ${theme === themeOption.id ? 'selected' : ''}`}
                    onClick={() => setTheme(themeOption.id)}
                  >
                    <div className={`theme-preview theme-preview-${themeOption.id}`}>
                      <div className="theme-preview-header"></div>
                      <div className="theme-preview-sidebar"></div>
                      <div className="theme-preview-editor"></div>
                    </div>
                    <div className="theme-info">
                      <div className="theme-name">
                        {themeOption.name}
                        {theme === themeOption.id && (
                          <VscCheck className="theme-check" />
                        )}
                      </div>
                      <div className="theme-description">{themeOption.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'editor' && (
            <>
              {/* Font Family Section */}
              <div className="settings-section">
                <h3>Font Family</h3>
                <p className="settings-description">Choose your preferred editor font</p>
                
                <div className="font-grid">
                  {fonts.map((font) => (
                    <div
                      key={font.id}
                      className={`font-card ${fontFamily === font.family ? 'selected' : ''}`}
                      onClick={() => setFontFamily(font.family)}
                    >
                      <div className="font-preview" style={{ fontFamily: font.family }}>
                        AaBbCc 123 {} =&gt;
                      </div>
                      <div className="font-name">
                        {font.name}
                        {fontFamily === font.family && (
                          <VscCheck className="font-check" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Font Size Section */}
              <div className="settings-section">
                <h3>Font Size</h3>
                <p className="settings-description">Adjust the editor font size</p>
                
                <div className="font-size-controls">
                  <div className="font-size-slider-container">
                    <input
                      type="range"
                      min="10"
                      max="24"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="font-size-slider"
                    />
                    <div className="font-size-value">{fontSize}px</div>
                  </div>
                  
                  <div className="font-size-presets">
                    {fontSizes.map((size) => (
                      <button
                        key={size}
                        className={`font-size-preset ${fontSize === size ? 'active' : ''}`}
                        onClick={() => setFontSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>

                  <div className="font-size-quick-actions">
                    <button
                      className="font-size-btn"
                      onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                      disabled={fontSize <= 10}
                    >
                      Decrease
                    </button>
                    <button
                      className="font-size-btn"
                      onClick={() => setFontSize(14)}
                    >
                      Reset
                    </button>
                    <button
                      className="font-size-btn"
                      onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                      disabled={fontSize >= 24}
                    >
                      Increase
                    </button>
                  </div>

                  <div className="font-preview-text" style={{ fontSize: `${fontSize}px`, fontFamily }}>
                    <div>The quick brown fox jumps over the lazy dog</div>
                    <div>function example() &#123;</div>
                    <div>&nbsp;&nbsp;return "Hello World";</div>
                    <div>&#125;</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button className="settings-btn settings-btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
