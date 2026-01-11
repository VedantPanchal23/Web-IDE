import React from 'react';
import {
  VscFiles, VscSearch, VscSourceControl,
  VscDebugAlt, VscExtensions, VscAccount,
  VscSettingsGear, VscBeaker, VscGitCommit,
  VscDatabase, VscTerminal, VscRunAll,
  VscBook, VscBell, VscLayersActive
} from 'react-icons/vsc';

// Activity Bar Icons (VS Code style sidebar)
export const ActivityBarIcons = {
  explorer: VscFiles,
  search: VscSearch,
  sourceControl: VscSourceControl,
  debug: VscDebugAlt,
  extensions: VscExtensions,
  testing: VscBeaker,
  commits: VscGitCommit,
  database: VscDatabase,
  terminal: VscTerminal,
  run: VscRunAll,
  documentation: VscBook,
  notifications: VscBell,
  layers: VscLayersActive,
  account: VscAccount,
  settings: VscSettingsGear
};

export default ActivityBarIcons;
