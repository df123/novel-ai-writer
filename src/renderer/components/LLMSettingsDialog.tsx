import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Tab,
  Tabs,
  Typography,
  Alert,
} from '@mui/material';
import { useSettingsStore } from '../store/settingsStore';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface LLMSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function LLMSettingsDialog({ open, onClose }: LLMSettingsDialogProps) {
  const [tabValue, setTabValue] = useState(0);
  const [openaiKey, setOpenaiKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { openaiApiKey, deepseekApiKey, loadSettings, updateSettings } = useSettingsStore();

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open, loadSettings]);

  useEffect(() => {
    setOpenaiKey(openaiApiKey);
    setDeepseekKey(deepseekApiKey);
  }, [openaiApiKey, deepseekApiKey]);

  const handleSaveOpenAI = async () => {
    try {
      await updateSettings({ openaiApiKey: openaiKey });
      setMessage({ type: 'success', text: 'OpenAI API密钥已保存' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败: ' + (error as Error).message });
    }
  };

  const handleSaveDeepSeek = async () => {
    try {
      await updateSettings({ deepseekApiKey: deepseekKey });
      setMessage({ type: 'success', text: 'DeepSeek API密钥已保存' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败: ' + (error as Error).message });
    }
  };

  const handleClose = () => {
    setOpenaiKey('');
    setDeepseekKey('');
    setMessage(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>LLM设置</DialogTitle>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab label="OpenAI" />
            <Tab label="DeepSeek" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Typography variant="body2" gutterBottom>
            输入您的OpenAI API密钥。密钥将加密存储在本地。
          </Typography>
          <TextField
            label="API Key"
            type="password"
            fullWidth
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="body2" gutterBottom>
            输入您的DeepSeek API密钥。密钥将加密存储在本地。
          </Typography>
          <TextField
            label="API Key"
            type="password"
            fullWidth
            value={deepseekKey}
            onChange={(e) => setDeepseekKey(e.target.value)}
            placeholder="sk-..."
          />
        </TabPanel>

        {message && (
          <Alert severity={message.type} sx={{ mt: 2 }}>
            {message.text}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>关闭</Button>
        {tabValue === 0 && (
          <Button onClick={handleSaveOpenAI} variant="contained">
            保存OpenAI密钥
          </Button>
        )}
        {tabValue === 1 && (
          <Button onClick={handleSaveDeepSeek} variant="contained">
            保存DeepSeek密钥
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
