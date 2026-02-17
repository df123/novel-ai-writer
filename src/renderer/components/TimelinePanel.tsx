import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTimelineStore } from '../store/timelineStore';
import { formatDate } from '../../shared/utils';

export default function TimelinePanel() {
  const { nodes, selectedNode, createNode, updateNode, deleteNode, selectNode } = useTimelineStore();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');

  const handleOpenCreateDialog = () => {
    setEditMode(false);
    setTitle('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (node: any) => {
    setEditMode(true);
    setEditId(node.id);
    setTitle(node.title);
    setDate(node.date.split('T')[0]);
    setDescription(node.description);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setTitle('');
    setDate('');
    setDescription('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    try {
      if (editMode && editId) {
        await updateNode(editId, { title, date, description });
      } else {
        await createNode(title, date, description);
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save timeline node:', error);
    }
  };

  const handleSelect = (id: string) => {
    if (selectedNode?.id === id) {
      selectNode(null);
    } else {
      selectNode(id);
    }
  };

  return (
    <Box sx={{ width: 300, display: 'flex', flexDirection: 'column', borderRight: 1, borderColor: 'divider' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">时间线</Typography>
        <IconButton size="small" onClick={handleOpenCreateDialog}>
          <AddIcon />
        </IconButton>
      </Box>

      <List sx={{ flex: 1, overflow: 'auto' }}>
        {nodes.map((node) => (
          <ListItem
            key={node.id}
            button
            selected={selectedNode?.id === node.id}
            onClick={() => handleSelect(node.id)}
            secondaryAction={
              <>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditDialog(node);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNode(node.id);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </>
            }
          >
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {selectedNode?.id === node.id && <CheckCircleIcon color="primary" fontSize="small" />}
                  <Typography variant="subtitle2" noWrap>
                    {node.title}
                  </Typography>
                </Box>
              }
              secondary={
                <>
                  <Typography variant="caption" display="block">
                    {formatDate(node.date)}
                  </Typography>
                  {node.description && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {node.description}
                    </Typography>
                  )}
                </>
              }
            />
          </ListItem>
        ))}
        {nodes.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              暂无时间节点，点击右上角添加
            </Typography>
          </Box>
        )}
      </List>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editMode ? '编辑时间节点' : '添加时间节点'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="标题"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            label="日期"
            type="date"
            fullWidth
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          <TextField
            label="描述"
            fullWidth
            multiline
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!title.trim()}>
            {editMode ? '保存' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
