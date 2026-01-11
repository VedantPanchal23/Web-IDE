import React from 'react';
import {
  VscFile, VscFolder, VscFolderOpened,
  VscJson, VscMarkdown, VscCode,
  VscFileCode, VscGist, VscNote,
  VscSymbolFile, VscDatabase, VscGear,
  VscFileBinary, VscFileMedia, VscFilePdf
} from 'react-icons/vsc';
import {
  SiJavascript, SiTypescript, SiReact, SiPython,
  SiHtml5, SiCss3, SiSass, SiDocker,
  SiGit, SiNpm, SiYarn, SiPhp,
  SiCplusplus, SiC, SiGo,
  SiRust, SiRuby, SiVuedotjs, SiAngular,
  SiSvelte, SiNodedotjs, SiMongodb, SiPostgresql
} from 'react-icons/si';
import { FaLock, FaFileAlt } from 'react-icons/fa';

// Professional file icon component matching VS Code style
export const FileIcon = ({ file, isOpen, size = 16 }) => {
  const baseStyle = {
    width: size,
    height: size,
    flexShrink: 0
  };

  // Folder icons
  if (file.type === 'folder') {
    if (isOpen) {
      return <VscFolderOpened style={{ ...baseStyle, color: '#dcb67a' }} />;
    }
    return <VscFolder style={{ ...baseStyle, color: '#dcb67a' }} />;
  }

  // Get file extension
  const extension = file.extension || file.name?.split('.').pop()?.toLowerCase();
  const filename = file.name?.toLowerCase();

  // Special files
  if (filename === 'package.json') return <SiNpm style={{ ...baseStyle, color: '#cb3837' }} />;
  if (filename === 'package-lock.json') return <SiNpm style={{ ...baseStyle, color: '#cb3837' }} />;
  if (filename === 'yarn.lock') return <SiYarn style={{ ...baseStyle, color: '#2c8ebb' }} />;
  if (filename === 'tsconfig.json') return <SiTypescript style={{ ...baseStyle, color: '#3178c6' }} />;
  if (filename === 'dockerfile') return <SiDocker style={{ ...baseStyle, color: '#2496ed' }} />;
  if (filename?.startsWith('.git')) return <SiGit style={{ ...baseStyle, color: '#f05032' }} />;
  if (filename?.endsWith('.lock')) return <FaLock style={{ ...baseStyle, color: '#858585' }} />;
  if (filename === 'readme.md') return <VscNote style={{ ...baseStyle, color: '#519aba' }} />;

  // Extension-based icons
  const iconMap = {
    // JavaScript/TypeScript
    'js': <SiJavascript style={{ ...baseStyle, color: '#f7df1e' }} />,
    'jsx': <SiReact style={{ ...baseStyle, color: '#61dafb' }} />,
    'mjs': <SiJavascript style={{ ...baseStyle, color: '#f7df1e' }} />,
    'cjs': <SiJavascript style={{ ...baseStyle, color: '#f7df1e' }} />,
    'ts': <SiTypescript style={{ ...baseStyle, color: '#3178c6' }} />,
    'tsx': <SiReact style={{ ...baseStyle, color: '#61dafb' }} />,
    
    // Python
    'py': <SiPython style={{ ...baseStyle, color: '#3776ab' }} />,
    'pyx': <SiPython style={{ ...baseStyle, color: '#3776ab' }} />,
    'pyi': <SiPython style={{ ...baseStyle, color: '#3776ab' }} />,
    
    // Web
    'html': <SiHtml5 style={{ ...baseStyle, color: '#e34c26' }} />,
    'htm': <SiHtml5 style={{ ...baseStyle, color: '#e34c26' }} />,
    'css': <SiCss3 style={{ ...baseStyle, color: '#1572b6' }} />,
    'scss': <SiSass style={{ ...baseStyle, color: '#cf649a' }} />,
    'sass': <SiSass style={{ ...baseStyle, color: '#cf649a' }} />,
    
    // Frameworks
    'vue': <SiVuedotjs style={{ ...baseStyle, color: '#4fc08d' }} />,
    'svelte': <SiSvelte style={{ ...baseStyle, color: '#ff3e00' }} />,
    
    // Config/Data
    'json': <VscJson style={{ ...baseStyle, color: '#cbcb41' }} />,
    'xml': <VscCode style={{ ...baseStyle, color: '#f69220' }} />,
    'yml': <VscGear style={{ ...baseStyle, color: '#cb171e' }} />,
    'yaml': <VscGear style={{ ...baseStyle, color: '#cb171e' }} />,
    'env': <VscGear style={{ ...baseStyle, color: '#ecd53f' }} />,
    
    // Documentation
    'md': <VscMarkdown style={{ ...baseStyle, color: '#519aba' }} />,
    'mdx': <VscMarkdown style={{ ...baseStyle, color: '#519aba' }} />,
    'txt': <VscNote style={{ ...baseStyle, color: '#858585' }} />,
    
    // Programming Languages
    'java': <VscFileCode style={{ ...baseStyle, color: '#ed8b00' }} />,
    'cpp': <SiCplusplus style={{ ...baseStyle, color: '#00599c' }} />,
    'c': <SiC style={{ ...baseStyle, color: '#a8b9cc' }} />,
    'h': <VscFileCode style={{ ...baseStyle, color: '#a8b9cc' }} />,
    'cs': <VscFileCode style={{ ...baseStyle, color: '#68217a' }} />,
    'go': <SiGo style={{ ...baseStyle, color: '#00add8' }} />,
    'rs': <SiRust style={{ ...baseStyle, color: '#dea584' }} />,
    'rb': <SiRuby style={{ ...baseStyle, color: '#cc342d' }} />,
    'php': <SiPhp style={{ ...baseStyle, color: '#777bb4' }} />,
    'kt': <VscFileCode style={{ ...baseStyle, color: '#7f52ff' }} />,
    'kts': <VscFileCode style={{ ...baseStyle, color: '#7f52ff' }} />,
    'scala': <VscFileCode style={{ ...baseStyle, color: '#dc322f' }} />,
    'swift': <VscFileCode style={{ ...baseStyle, color: '#fa7343' }} />,
    'dart': <VscFileCode style={{ ...baseStyle, color: '#0175c2' }} />,
    'r': <VscFileCode style={{ ...baseStyle, color: '#276dc3' }} />,
    'lua': <VscFileCode style={{ ...baseStyle, color: '#000080' }} />,
    'pl': <VscFileCode style={{ ...baseStyle, color: '#02569b' }} />,
    'hs': <VscFileCode style={{ ...baseStyle, color: '#5e5086' }} />,
    'ex': <VscFileCode style={{ ...baseStyle, color: '#6e4a7e' }} />,
    'exs': <VscFileCode style={{ ...baseStyle, color: '#6e4a7e' }} />,
    'erl': <VscFileCode style={{ ...baseStyle, color: '#b83998' }} />,
    'groovy': <VscFileCode style={{ ...baseStyle, color: '#4298b8' }} />,
    
    // Shell
    'sh': <VscSymbolFile style={{ ...baseStyle, color: '#4eaa25' }} />,
    'bash': <VscSymbolFile style={{ ...baseStyle, color: '#4eaa25' }} />,
    
    // Database
    'sql': <VscDatabase style={{ ...baseStyle, color: '#c178b3' }} />,
    'db': <VscDatabase style={{ ...baseStyle, color: '#c178b3' }} />,
    
    // Binary/Media
    'pdf': <VscFilePdf style={{ ...baseStyle, color: '#f40f02' }} />,
    'png': <VscFileMedia style={{ ...baseStyle, color: '#858585' }} />,
    'jpg': <VscFileMedia style={{ ...baseStyle, color: '#858585' }} />,
    'jpeg': <VscFileMedia style={{ ...baseStyle, color: '#858585' }} />,
    'gif': <VscFileMedia style={{ ...baseStyle, color: '#858585' }} />,
    'svg': <VscFileMedia style={{ ...baseStyle, color: '#ffb13b' }} />,
    'ico': <VscFileMedia style={{ ...baseStyle, color: '#858585' }} />,
    'exe': <VscFileBinary style={{ ...baseStyle, color: '#858585' }} />,
    'dll': <VscFileBinary style={{ ...baseStyle, color: '#858585' }} />,
    'log': <VscNote style={{ ...baseStyle, color: '#858585' }} />
  };

  return iconMap[extension] || <VscFile style={{ ...baseStyle, color: '#858585' }} />;
};

export default FileIcon;
