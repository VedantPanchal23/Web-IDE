import React, { useState, useEffect } from 'react';
import { 
  VscExtensions, VscSearch, VscCloudDownload, VscTrash, VscCheck,
  VscStarFull, VscStarEmpty, VscRefresh, VscGear, VscInfo, VscWarning
} from 'react-icons/vsc';
import './Extensions.css';

/**
 * Extensions Component
 * Professional extension marketplace UI matching VS Code
 */
const Extensions = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [installedExtensions, setInstalledExtensions] = useState([]);
  const [popularExtensions, setPopularExtensions] = useState([]);
  const [filteredExtensions, setFilteredExtensions] = useState([]);
  const [selectedExtension, setSelectedExtension] = useState(null);
  const [activeTab, setActiveTab] = useState('marketplace'); // 'marketplace' or 'installed'
  const [isInstalling, setIsInstalling] = useState(new Set());

  // Mock popular extensions
  useEffect(() => {
    const mockPopular = [
      {
        id: 'prettier',
        name: 'Prettier - Code formatter',
        author: 'Prettier',
        description: 'Code formatter using prettier',
        version: '10.1.0',
        downloads: '45M',
        rating: 4.8,
        installed: false,
        icon: '🎨'
      },
      {
        id: 'eslint',
        name: 'ESLint',
        author: 'Microsoft',
        description: 'Integrates ESLint JavaScript into VS Code',
        version: '2.4.2',
        downloads: '38M',
        rating: 4.7,
        installed: true,
        icon: '🔍'
      },
      {
        id: 'gitlens',
        name: 'GitLens',
        author: 'GitKraken',
        description: 'Supercharge Git within VS Code',
        version: '14.5.1',
        downloads: '28M',
        rating: 4.9,
        installed: false,
        icon: '🔎'
      },
      {
        id: 'live-server',
        name: 'Live Server',
        author: 'Ritwick Dey',
        description: 'Launch a development local Server with live reload',
        version: '5.7.9',
        downloads: '35M',
        rating: 4.6,
        installed: false,
        icon: '🌐'
      },
      {
        id: 'python',
        name: 'Python',
        author: 'Microsoft',
        description: 'IntelliSense, linting, debugging for Python',
        version: '2023.20.0',
        downloads: '75M',
        rating: 4.8,
        installed: true,
        icon: '🐍'
      },
      {
        id: 'vim',
        name: 'Vim',
        author: 'vscodevim',
        description: 'Vim emulation for Visual Studio Code',
        version: '1.26.0',
        downloads: '6M',
        rating: 4.5,
        installed: false,
        icon: '⌨️'
      },
      {
        id: 'docker',
        name: 'Docker',
        author: 'Microsoft',
        description: 'Makes it easy to create, manage, and debug containers',
        version: '1.28.0',
        downloads: '22M',
        rating: 4.7,
        installed: true,
        icon: '🐳'
      },
      {
        id: 'copilot',
        name: 'GitHub Copilot',
        author: 'GitHub',
        description: 'Your AI pair programmer',
        version: '1.133.0',
        downloads: '15M',
        rating: 4.9,
        installed: false,
        icon: '🤖'
      },
      {
        id: 'tabnine',
        name: 'Tabnine AI',
        author: 'TabNine',
        description: 'AI-powered code completion',
        version: '3.6.45',
        downloads: '12M',
        rating: 4.4,
        installed: false,
        icon: '✨'
      },
      {
        id: 'material-theme',
        name: 'Material Theme',
        author: 'Equinusocio',
        description: 'The most epic theme now for VS Code',
        version: '34.0.0',
        downloads: '8M',
        rating: 4.6,
        installed: false,
        icon: '🎨'
      }
    ];

    setPopularExtensions(mockPopular);
    setInstalledExtensions(mockPopular.filter(ext => ext.installed));
    setFilteredExtensions(mockPopular);
  }, []);

  // Filter extensions based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredExtensions(popularExtensions);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = popularExtensions.filter(ext =>
      ext.name.toLowerCase().includes(query) ||
      ext.author.toLowerCase().includes(query) ||
      ext.description.toLowerCase().includes(query)
    );
    setFilteredExtensions(filtered);
  }, [searchQuery, popularExtensions]);

  const handleInstall = async (extensionId) => {
    setIsInstalling(prev => new Set([...prev, extensionId]));
    
    // Simulate installation
    setTimeout(() => {
      setPopularExtensions(prev =>
        prev.map(ext =>
          ext.id === extensionId ? { ...ext, installed: true } : ext
        )
      );
      setInstalledExtensions(prev => [
        ...prev,
        popularExtensions.find(ext => ext.id === extensionId)
      ]);
      setIsInstalling(prev => {
        const newSet = new Set(prev);
        newSet.delete(extensionId);
        return newSet;
      });
      console.log('Installed extension:', extensionId);
    }, 1500);
  };

  const handleUninstall = async (extensionId) => {
    const confirmed = window.confirm('Are you sure you want to uninstall this extension?');
    if (!confirmed) return;

    setIsInstalling(prev => new Set([...prev, extensionId]));
    
    // Simulate uninstallation
    setTimeout(() => {
      setPopularExtensions(prev =>
        prev.map(ext =>
          ext.id === extensionId ? { ...ext, installed: false } : ext
        )
      );
      setInstalledExtensions(prev =>
        prev.filter(ext => ext.id !== extensionId)
      );
      setIsInstalling(prev => {
        const newSet = new Set(prev);
        newSet.delete(extensionId);
        return newSet;
      });
      console.log('Uninstalled extension:', extensionId);
    }, 1000);
  };

  const renderRating = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<VscStarFull key={`star-${i}`} className="star filled" />);
    }
    
    if (hasHalfStar) {
      stars.push(<VscStarEmpty key="star-half" className="star half" />);
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<VscStarEmpty key={`empty-${i}`} className="star empty" />);
    }

    return <div className="rating-stars">{stars}</div>;
  };

  const renderExtensionCard = (extension) => {
    const isInstalling_ = isInstalling.has(extension.id);

    return (
      <div 
        key={extension.id} 
        className={`extension-card ${selectedExtension?.id === extension.id ? 'selected' : ''}`}
        onClick={() => setSelectedExtension(extension)}
      >
        <div className="extension-header">
          <div className="extension-icon">{extension.icon}</div>
          <div className="extension-info">
            <div className="extension-name">{extension.name}</div>
            <div className="extension-author">{extension.author}</div>
          </div>
          <div className="extension-actions">
            {extension.installed ? (
              <button
                className="btn-uninstall"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUninstall(extension.id);
                }}
                disabled={isInstalling_}
                title="Uninstall"
              >
                {isInstalling_ ? <VscRefresh className="spinning" /> : <VscTrash />}
              </button>
            ) : (
              <button
                className="btn-install"
                onClick={(e) => {
                  e.stopPropagation();
                  handleInstall(extension.id);
                }}
                disabled={isInstalling_}
                title="Install"
              >
                {isInstalling_ ? <VscRefresh className="spinning" /> : <VscCloudDownload />}
              </button>
            )}
          </div>
        </div>
        
        <div className="extension-description">{extension.description}</div>
        
        <div className="extension-footer">
          <div className="extension-rating">
            {renderRating(extension.rating)}
            <span className="rating-value">{extension.rating}</span>
          </div>
          <div className="extension-downloads">{extension.downloads} downloads</div>
          {extension.installed && (
            <div className="installed-badge">
              <VscCheck /> Installed
            </div>
          )}
        </div>
      </div>
    );
  };

  const displayExtensions = activeTab === 'installed' 
    ? installedExtensions 
    : filteredExtensions;

  return (
    <div className="extensions-panel">
      {/* Header */}
      <div className="extensions-header">
        <div className="header-tabs">
          <button
            className={`tab ${activeTab === 'marketplace' ? 'active' : ''}`}
            onClick={() => setActiveTab('marketplace')}
          >
            <VscExtensions />
            Marketplace
            <span className="tab-count">{popularExtensions.length}</span>
          </button>
          <button
            className={`tab ${activeTab === 'installed' ? 'active' : ''}`}
            onClick={() => setActiveTab('installed')}
          >
            <VscCheck />
            Installed
            <span className="tab-count">{installedExtensions.length}</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="extensions-search">
        <div className="search-input-wrapper">
          <VscSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search extensions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Extensions List */}
      <div className="extensions-list">
        {activeTab === 'marketplace' && searchQuery === '' && (
          <div className="section-header">
            <VscStarFull />
            <span>Popular Extensions</span>
          </div>
        )}

        {displayExtensions.length === 0 ? (
          <div className="extensions-empty">
            <VscExtensions size={48} />
            <p>No extensions found</p>
            {searchQuery && <p>Try a different search term</p>}
          </div>
        ) : (
          displayExtensions.map(renderExtensionCard)
        )}
      </div>

      {/* Extension Details Sidebar */}
      {selectedExtension && (
        <div className="extension-details">
          <div className="details-header">
            <div className="details-icon">{selectedExtension.icon}</div>
            <div>
              <h3>{selectedExtension.name}</h3>
              <p className="details-author">{selectedExtension.author}</p>
            </div>
            <button
              className="close-details"
              onClick={() => setSelectedExtension(null)}
              title="Close"
            >
              ×
            </button>
          </div>

          <div className="details-actions">
            {selectedExtension.installed ? (
              <button
                className="btn btn-danger btn-block"
                onClick={() => handleUninstall(selectedExtension.id)}
                disabled={isInstalling.has(selectedExtension.id)}
              >
                <VscTrash /> Uninstall
              </button>
            ) : (
              <button
                className="btn btn-primary btn-block"
                onClick={() => handleInstall(selectedExtension.id)}
                disabled={isInstalling.has(selectedExtension.id)}
              >
                <VscCloudDownload /> Install
              </button>
            )}
          </div>

          <div className="details-content">
            <div className="details-section">
              <h4>Description</h4>
              <p>{selectedExtension.description}</p>
            </div>

            <div className="details-section">
              <h4>Details</h4>
              <div className="detail-item">
                <span className="detail-label">Version:</span>
                <span className="detail-value">{selectedExtension.version}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Downloads:</span>
                <span className="detail-value">{selectedExtension.downloads}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Rating:</span>
                <span className="detail-value">
                  {selectedExtension.rating} / 5.0
                </span>
              </div>
            </div>

            <div className="details-section">
              <h4>Features</h4>
              <ul className="feature-list">
                <li>✅ Syntax highlighting</li>
                <li>✅ Code completion</li>
                <li>✅ Error detection</li>
                <li>✅ Quick fixes</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Extensions;
