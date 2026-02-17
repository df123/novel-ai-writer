import React, { useEffect, useState } from 'react';
import { Container, Box } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import WelcomeDialog from './components/WelcomeDialog';
import { useProjectStore } from './store/projectStore';

function App() {
  const { loadProjects } = useProjectStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      await loadProjects();
      setIsReady(true);
    };

    initApp();
  }, [loadProjects]);

  if (!isReady) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Box>加载中...</Box>
      </Box>
    );
  }

  return (
    <BrowserRouter>
      <MainLayout />
      <WelcomeDialog />
    </BrowserRouter>
  );
}

export default App;
