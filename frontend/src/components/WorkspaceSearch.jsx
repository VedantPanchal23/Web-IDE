import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { apiService } from '../services/api';
import { VscSearch, VscCaseSensitive, VscWholeWord, VscRegex, VscFile, VscChevronRight, VscChevronDown, VscClose } from 'react-icons/vsc';
import { FileIcon } from './icons/FileIcons';
import './WorkspaceSearch.css';

/**
 * Workspace Search - GitHub Codespaces style
 * Search across all files in the workspace
 * Keyboard shortcut: Ctrl+Shift+F (Cmd+Shift+F)
 */
const WorkspaceSearch = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [searchOptions, setSearchOptions] = useState({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
    includePattern: '',
    excludePattern: '*.log, *.tmp, node_modules/*, .git/*'
  });
  const [expandedFiles, setExpandedFiles] = useState(new Set());
  const searchInputRef = useRef(null);
  const { files, loadFileContent, currentProject } = useProject();

  // Auto-focus on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Search function
  const performSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      // Use backend search for better performance with large projects
      const projectId = currentProject?._id || currentProject?.id;
      if (projectId) {
        try {
          const response = await apiService.post('/search/workspace', {
            projectId: projectId,
            query: searchQuery,
            caseSensitive: searchOptions.caseSensitive,
            wholeWord: searchOptions.wholeWord,
            useRegex: searchOptions.useRegex,
            includePattern: searchOptions.includePattern,
            excludePattern: searchOptions.excludePattern
          });

          if (response.data.success) {
            const results = response.data.results || [];
            console.log('Search results from backend:', results);
            
            // Transform backend results to match expected structure
            const transformedResults = results.map(r => ({
              file: {
                _id: r.fileId,
                id: r.fileId,
                name: r.fileName,
                path: r.filePath
              },
              matches: r.matches,
              totalMatches: r.totalMatches
            }));
            
            setSearchResults(transformedResults);
            setIsSearching(false);
            return;
          }
        } catch (backendError) {
          console.warn('Backend search failed, falling back to client-side:', backendError);
          // Fall through to client-side search
        }
      }

      // Fallback: Client-side search through files
      const results = [];
      console.log('Client-side search, files available:', files?.length);
      
      for (const file of files || []) {
        if (!file.content) continue;

        // Apply exclude patterns
        const excludePatterns = searchOptions.excludePattern
          .split(',')
          .map(p => p.trim())
          .filter(p => p);
        
        const shouldExclude = excludePatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
          return regex.test(file.path || file.name);
        });

        if (shouldExclude) continue;

        // Apply include patterns if specified
        if (searchOptions.includePattern) {
          const includePatterns = searchOptions.includePattern
            .split(',')
            .map(p => p.trim())
            .filter(p => p);
          
          const shouldInclude = includePatterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
            return regex.test(file.path || file.name);
          });

          if (!shouldInclude) continue;
        }

        // Perform search
        let searchPattern;
        if (searchOptions.useRegex) {
          try {
            searchPattern = new RegExp(
              searchQuery,
              searchOptions.caseSensitive ? 'g' : 'gi'
            );
          } catch (e) {
            console.error('Invalid regex:', e);
            continue;
          }
        } else {
          const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pattern = searchOptions.wholeWord
            ? `\\b${escaped}\\b`
            : escaped;
          searchPattern = new RegExp(
            pattern,
            searchOptions.caseSensitive ? 'g' : 'gi'
          );
        }

        const lines = file.content.split('\n');
        const matches = [];

        lines.forEach((line, lineIndex) => {
          const lineMatches = [...line.matchAll(searchPattern)];
          if (lineMatches.length > 0) {
            matches.push({
              lineNumber: lineIndex + 1,
              lineText: line,
              matchCount: lineMatches.length,
              // Get context lines (1 before, 1 after)
              contextBefore: lineIndex > 0 ? lines[lineIndex - 1] : null,
              contextAfter: lineIndex < lines.length - 1 ? lines[lineIndex + 1] : null
            });
          }
        });

        if (matches.length > 0) {
          results.push({
            file: file,
            matches: matches,
            totalMatches: matches.reduce((sum, m) => sum + m.matchCount, 0)
          });
        }
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-expand all results when search completes
  useEffect(() => {
    if (searchResults.length > 0) {
      const allFileIds = searchResults
        .filter(r => r && r.file)
        .map(r => r.file._id || r.file.id || r.file.path);
      setExpandedFiles(new Set(allFileIds));
    }
  }, [searchResults]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchOptions, files]);

  const toggleFileExpansion = (fileId) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId);
    } else {
      newExpanded.add(fileId);
    }
    setExpandedFiles(newExpanded);
  };

  const openFileAtLine = async (file, lineNumber) => {
    try {
      // Load the file content
      await loadFileContent(file._id || file.id);
      
      // Trigger event to scroll to line
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('goto-line', {
          detail: { lineNumber }
        }));
      }, 100);
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const replaceAll = async () => {
    if (!searchQuery || replaceQuery === undefined) {
      alert('Please enter search text');
      return;
    }

    const fileIds = searchResults.map(r => r.file._id || r.file.id);
    const confirmed = window.confirm(
      `Replace all ${totalMatches} occurrences of "${searchQuery}" with "${replaceQuery}" in ${totalFiles} files?`
    );

    if (!confirmed) return;

    try {
      const projectId = currentProject?._id || currentProject?.id;
      
      if (!projectId) {
        alert('No project selected');
        return;
      }

      console.log('Replace request:', {
        projectId,
        searchQuery,
        replaceText: replaceQuery,
        fileIds,
        caseSensitive: searchOptions.caseSensitive,
        wholeWord: searchOptions.wholeWord,
        useRegex: searchOptions.useRegex
      });
      
      const response = await apiService.post('/search/replace', {
        projectId,
        searchQuery,
        replaceText: replaceQuery,
        fileIds,
        caseSensitive: searchOptions.caseSensitive,
        wholeWord: searchOptions.wholeWord,
        useRegex: searchOptions.useRegex
      });

      console.log('Replace response:', response.data);

      if (response.data.success) {
        const stats = response.data.stats;
        alert(`Successfully replaced ${stats.totalReplacements} occurrences in ${stats.filesModified} files`);
        // Refresh search results
        await performSearch();
      } else {
        alert(`Replace failed: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Replace failed:', error);
      if (error.message.includes('token') || error.message.includes('log in')) {
        alert('Authentication required. Please log in again.');
      } else {
        alert(`Replace operation failed: ${error.response?.data?.message || error.message}`);
      }
    }
  };

  const highlightMatch = (text, query) => {
    if (!query) return text;

    let pattern;
    if (searchOptions.useRegex) {
      try {
        pattern = new RegExp(
          query,
          searchOptions.caseSensitive ? 'g' : 'gi'
        );
      } catch (e) {
        return text;
      }
    } else {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patternStr = searchOptions.wholeWord ? `\\b${escaped}\\b` : escaped;
      pattern = new RegExp(patternStr, searchOptions.caseSensitive ? 'g' : 'gi');
    }

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.substring(lastIndex, match.index)}
          </span>
        );
      }
      parts.push(
        <span key={`match-${match.index}`} className="search-highlight">
          {match[0]}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.substring(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : text;
  };

  const totalMatches = searchResults.reduce((sum, r) => sum + r.totalMatches, 0);
  const totalFiles = searchResults.length;

  if (!isOpen) return null;

  return (
    <div className="workspace-search-panel">
      <div className="workspace-search-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <VscSearch />
          <h3>Search</h3>
        </div>
        <button className="close-button" onClick={onClose} title="Close (Escape)">
          <VscClose />
        </button>
      </div>

      <div className="workspace-search-input-section">
        <div className="search-input-wrapper">
          <input
            ref={searchInputRef}
            type="text"
            className="workspace-search-input"
            placeholder="Search in files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearching && <div className="search-spinner">⏳</div>}
        </div>

        {/* Toggle replace button */}
        <div style={{ marginBottom: '8px' }}>
          <button 
            className="toggle-replace-btn"
            onClick={() => setShowReplace(!showReplace)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#858585',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '4px 0'
            }}
          >
            {showReplace ? '▼' : '▶'} Replace
          </button>
        </div>

        {showReplace && (
          <div className="search-input-wrapper" style={{ marginBottom: '8px' }}>
            <input
              type="text"
              className="workspace-search-input"
              placeholder="Replace with..."
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
            />
          </div>
        )}

        {showReplace && searchResults.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button
              onClick={() => replaceAll()}
              style={{
                padding: '6px 12px',
                backgroundColor: '#0e639c',
                border: 'none',
                borderRadius: '3px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                flex: 1
              }}
            >
              Replace All ({totalMatches})
            </button>
          </div>
        )}

        <div className="search-options">
          <button
            className={`search-option-btn ${searchOptions.caseSensitive ? 'active' : ''}`}
            onClick={() => setSearchOptions({ ...searchOptions, caseSensitive: !searchOptions.caseSensitive })}
            title="Match Case (Alt+C)"
          >
            <VscCaseSensitive />
          </button>
          <button
            className={`search-option-btn ${searchOptions.wholeWord ? 'active' : ''}`}
            onClick={() => setSearchOptions({ ...searchOptions, wholeWord: !searchOptions.wholeWord })}
            title="Match Whole Word (Alt+W)"
          >
            <VscWholeWord />
          </button>
          <button
            className={`search-option-btn ${searchOptions.useRegex ? 'active' : ''}`}
            onClick={() => setSearchOptions({ ...searchOptions, useRegex: !searchOptions.useRegex })}
            title="Use Regular Expression (Alt+R)"
          >
            <VscRegex />
          </button>
        </div>

        <details className="search-filters">
          <summary>Files to include/exclude</summary>
          <div className="filter-inputs">
            <input
              type="text"
              placeholder="e.g. *.js, src/**"
              value={searchOptions.includePattern}
              onChange={(e) => setSearchOptions({ ...searchOptions, includePattern: e.target.value })}
              className="filter-input"
            />
            <input
              type="text"
              placeholder="e.g. *.log, node_modules/*"
              value={searchOptions.excludePattern}
              onChange={(e) => setSearchOptions({ ...searchOptions, excludePattern: e.target.value })}
              className="filter-input"
            />
          </div>
        </details>
      </div>

      <div className="workspace-search-results">
        {searchQuery && (
          <div className="search-results-summary">
            {totalMatches} {totalMatches === 1 ? 'result' : 'results'} in {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
          </div>
        )}

        {searchResults.length === 0 && searchQuery && !isSearching && (
          <div className="search-no-results">
            No results found for "{searchQuery}"
          </div>
        )}

        {searchResults.filter(result => result && result.file).map((result) => {
          const fileId = result.file._id || result.file.id || result.file.path;
          const isExpanded = expandedFiles.has(fileId);

          return (
            <div key={fileId} className="search-result-file">
              <div
                className="search-result-file-header"
                onClick={() => toggleFileExpansion(fileId)}
              >
                <span className="expand-icon">
                  {isExpanded ? <VscChevronDown /> : <VscChevronRight />}
                </span>
                <FileIcon file={result.file} size={16} />
                <span className="file-name">{result.file.name || result.file.path}</span>
                <span className="match-count">{result.totalMatches}</span>
              </div>

              {isExpanded && (
                <div className="search-result-matches">
                  {result.matches.map((match, index) => (
                    <div
                      key={`${fileId}-${match.lineNumber}`}
                      className="search-result-match"
                      onClick={() => openFileAtLine(result.file, match.lineNumber)}
                    >
                      <div className="match-line-number">{match.lineNumber}</div>
                      <div className="match-line-content">
                        {highlightMatch(match.lineText, searchQuery)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkspaceSearch;
