import React from 'react';
import {
  VscDebugStart, VscDebugRestart, VscDebugStop,
  VscDebugPause, VscDebugContinue, VscDebugStepOver,
  VscDebugStepInto, VscDebugStepOut, VscSave,
  VscSaveAll, VscRefresh, VscCopy, VscPaste,
  VscCut, VscUndo, VscRedo, VscSearch,
  VscReplace, VscFindInFiles, VscSplitHorizontal,
  VscSplitVertical, VscClose, VscAdd, VscRemove,
  VscEdit, VscTrash, VscNewFile, VscNewFolder,
  VscFolderOpened, VscChevronRight, VscChevronDown,
  VscChevronLeft, VscChevronUp, VscMoreHorizontal,
  VscEllipsis, VscKebabVertical, VscMenu, VscCheck,
  VscArrowRight, VscArrowLeft, VscLinkExternal,
  VscCloudDownload, VscCloudUpload, VscSync,
  VscWarning, VscError, VscInfo, VscPass,
  VscCircleFilled, VscCircleOutline, VscStarEmpty,
  VscStarFull, VscHeart, VscComment, VscBug,
  VscLightbulb, VscFileCode, VscBeaker, VscTerminal,
  VscPreview, VscOpenPreview, VscEyeClosed, VscEye
} from 'react-icons/vsc';

// Toolbar Icons (IntelliJ/VS Code style)
export const ToolbarIcons = {
  // Run/Debug
  run: VscDebugStart,
  restart: VscDebugRestart,
  stop: VscDebugStop,
  pause: VscDebugPause,
  continue: VscDebugContinue,
  stepOver: VscDebugStepOver,
  stepInto: VscDebugStepInto,
  stepOut: VscDebugStepOut,
  
  // File Operations
  save: VscSave,
  saveAll: VscSaveAll,
  newFile: VscNewFile,
  newFolder: VscNewFolder,
  delete: VscTrash,
  edit: VscEdit,
  
  // Edit Operations
  copy: VscCopy,
  paste: VscPaste,
  cut: VscCut,
  undo: VscUndo,
  redo: VscRedo,
  
  // Search
  search: VscSearch,
  replace: VscReplace,
  findInFiles: VscFindInFiles,
  
  // Layout
  splitHorizontal: VscSplitHorizontal,
  splitVertical: VscSplitVertical,
  close: VscClose,
  
  // Navigation
  chevronRight: VscChevronRight,
  chevronDown: VscChevronDown,
  chevronLeft: VscChevronLeft,
  chevronUp: VscChevronUp,
  arrowRight: VscArrowRight,
  arrowLeft: VscArrowLeft,
  
  // Actions
  add: VscAdd,
  remove: VscRemove,
  refresh: VscRefresh,
  sync: VscSync,
  more: VscMoreHorizontal,
  ellipsis: VscEllipsis,
  kebab: VscKebabVertical,
  menu: VscMenu,
  check: VscCheck,
  
  // Status
  warning: VscWarning,
  error: VscError,
  info: VscInfo,
  success: VscPass,
  circleFilled: VscCircleFilled,
  circleOutline: VscCircleOutline,
  
  // Others
  star: VscStarEmpty,
  starFilled: VscStarFull,
  heart: VscHeart,
  comment: VscComment,
  bug: VscBug,
  lightbulb: VscLightbulb,
  code: VscFileCode,
  test: VscBeaker,
  terminal: VscTerminal,
  preview: VscPreview,
  openPreview: VscOpenPreview,
  eye: VscEye,
  eyeClosed: VscEyeClosed,
  link: VscLinkExternal,
  download: VscCloudDownload,
  upload: VscCloudUpload,
  folder: VscFolderOpened
};

export default ToolbarIcons;
