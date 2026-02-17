import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  Divider,
  Menu,
  MenuItem,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useChatStore } from '../store/chatStore';
import { useProjectStore } from '../store/projectStore';
import { useTimelineStore } from '../store/timelineStore';
import { useCharacterStore } from '../store/characterStore';
import { formatTimestamp } from '../../shared/utils';

export default function ChatPanel() {
  const { chats, currentChat, messages, isLoading, createChat, selectChat, sendMessage, deleteMessage } = useChatStore();
  const { currentProject } = useProjectStore();
  const { nodes: timelineNodes, selectedNode } = useTimelineStore();
  const { characters, selectedCharacters } = useCharacterStore();
  
  const [inputText, setInputText] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentProject && chats.length === 0) {
      createChat('默认对话');
    }
  }, [currentProject, chats.length, createChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    try {
      await sendMessage(inputText, {
        systemPrompt: '你是一个专业的小说写作助手。',
        providerName: 'openai',
        modelName: 'gpt-3.5-turbo',
        timelineId: selectedNode?.id,
        characterIds: Array.from(selectedCharacters),
      });
      setInputText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, messageId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedMessageId(messageId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMessageId(null);
  };

  const handleDeleteMessage = () => {
    if (selectedMessageId) {
      deleteMessage(selectedMessageId);
    }
    handleMenuClose();
  };

  if (!currentProject) {
    return (
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography>请先选择或创建一个项目</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 400 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ p: 2 }}>
          写作区
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <List>
          {messages.map((message) => (
            <ListItem
              key={message.id}
              sx={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                mb: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
                <Chip
                  label={message.role === 'user' ? '作者' : 'AI助手'}
                  color={message.role === 'user' ? 'primary' : 'secondary'}
                  size="small"
                />
                <Typography variant="caption" sx={{ ml: 1 }}>
                  {formatTimestamp(message.timestamp)}
                </Typography>
                <IconButton
                  size="small"
                  sx={{ ml: 'auto' }}
                  onClick={(e) => handleMenuClick(e, message.id)}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  width: '100%',
                  bgcolor: message.role === 'user' ? 'primary.50' : 'grey.50',
                }}
              >
                <Typography variant="body1" whiteSpace="pre-wrap">
                  {message.content}
                </Typography>
              </Paper>
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
      </Box>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          placeholder="输入您的问题或写作需求..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
          InputProps={{
            endAdornment: (
              <IconButton onClick={handleSend} disabled={!inputText.trim() || isLoading}>
                <SendIcon />
              </IconButton>
            ),
          }}
        />
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleDeleteMessage}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          删除
        </MenuItem>
      </Menu>
    </Box>
  );
}
