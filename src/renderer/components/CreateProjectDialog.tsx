import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
} from '@mui/material';
import { useProjectStore } from '../store/projectStore';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateProjectDialog({ open, onClose }: CreateProjectDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const { createProject } = useProjectStore();

  const handleSubmit = async () => {
    if (!title.trim()) return;

    try {
      await createProject(title, description);
      setTitle('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>创建新项目</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <TextField
            autoFocus
            label="项目标题"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="项目描述"
            fullWidth
            multiline
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!title.trim()}>
          创建
        </Button>
      </DialogActions>
    </Dialog>
  );
}
