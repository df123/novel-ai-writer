import React, { useEffect } from 'react';
import { Box, AppBar, Toolbar, Typography, IconButton, Menu, MenuItem } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import { useProjectStore } from '../store/projectStore';
import { useChatStore } from '../store/chatStore';
import { useTimelineStore } from '../store/timelineStore';
import { useCharacterStore } from '../store/characterStore';
import ChatPanel from './ChatPanel';
import TimelinePanel from './TimelinePanel';
import CharacterPanel from './CharacterPanel';
import ProjectSelector from './ProjectSelector';
import CreateProjectDialog from './CreateProjectDialog';
import LLMSettingsDialog from './LLMSettingsDialog';

export default function MainLayout() {
  const { currentProject } = useProjectStore();
  const { loadChats } = useChatStore();
  const { loadNodes } = useTimelineStore();
  const { loadCharacters } = useCharacterStore();
  
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showCreateProject, setShowCreateProject] = React.useState(false);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSettingsOpen = () => {
    setShowSettings(true);
    handleMenuClose();
  };

  useEffect(() => {
    if (currentProject) {
      loadChats(currentProject.id);
      loadNodes(currentProject.id);
      loadCharacters(currentProject.id);
    }
  }, [currentProject, loadChats, loadNodes, loadCharacters]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static" elevation={1}>
        <Toolbar variant="dense">
          <HomeIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            NovelAI Writer
          </Typography>
          
          <ProjectSelector />
          
          <IconButton color="inherit" onClick={handleSettingsOpen}>
            <SettingsIcon />
          </IconButton>
          <IconButton color="inherit" onClick={handleMenuClick}>
            <SettingsIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => setShowCreateProject(true)}>新建项目</MenuItem>
        <MenuItem onClick={handleSettingsOpen}>LLM设置</MenuItem>
      </Menu>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <TimelinePanel />
        <ChatPanel />
        <CharacterPanel />
      </Box>

      <CreateProjectDialog
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
      />
      
      <LLMSettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </Box>
  );
}
