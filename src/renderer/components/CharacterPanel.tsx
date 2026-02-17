import React, { useState } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import { useCharacterStore } from '../store/characterStore';

export default function CharacterPanel() {
  const { characters, selectedCharacters, createCharacter, updateCharacter, deleteCharacter, toggleCharacterSelection } = useCharacterStore();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('');
  const [background, setBackground] = useState('');
  const [relationships, setRelationships] = useState('');

  const handleOpenCreateDialog = () => {
    setEditMode(false);
    setName('');
    setPersonality('');
    setBackground('');
    setRelationships('');
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (character: any) => {
    setEditMode(true);
    setEditId(character.id);
    setName(character.name);
    setPersonality(character.personality || '');
    setBackground(character.background || '');
    setRelationships(character.relationships || '');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setName('');
    setPersonality('');
    setBackground('');
    setRelationships('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    try {
      const characterData = {
        name,
        personality,
        background,
        relationships,
      };

      if (editMode && editId) {
        await updateCharacter(editId, characterData);
      } else {
        await createCharacter(characterData);
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save character:', error);
    }
  };

  return (
    <Box sx={{ width: 320, display: 'flex', flexDirection: 'column', borderLeft: 1, borderColor: 'divider' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">人物</Typography>
        <IconButton size="small" onClick={handleOpenCreateDialog}>
          <AddIcon />
        </IconButton>
      </Box>

      {selectedCharacters.size > 0 && (
        <Box sx={{ p: 1, bgcolor: 'action.selected' }}>
          <Typography variant="caption" display="block" gutterBottom>
            已选择 {selectedCharacters.size} 个人物
          </Typography>
        </Box>
      )}

      <List sx={{ flex: 1, overflow: 'auto' }}>
        {characters.map((character) => (
          <ListItem
            key={character.id}
            button
            onClick={() => toggleCharacterSelection(character.id)}
            secondaryAction={
              <>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditDialog(character);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCharacter(character.id);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </>
            }
          >
            <Checkbox
              edge="start"
              checked={selectedCharacters.has(character.id)}
              sx={{ mr: 1 }}
            />
            <Avatar sx={{ mr: 2, bgcolor: 'secondary.main' }}>
              <PersonIcon />
            </Avatar>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2">{character.name}</Typography>
                  {selectedCharacters.has(character.id) && (
                    <Chip label="已选中" size="small" color="primary" variant="outlined" />
                  )}
                </Box>
              }
              secondary={
                <>
                  {character.personality && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {character.personality}
                    </Typography>
                  )}
                </>
              }
            />
          </ListItem>
        ))}
        {characters.length === 0 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              暂无人物，点击右上角添加
            </Typography>
          </Box>
        )}
      </List>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editMode ? '编辑人物' : '添加人物'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="姓名"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            label="性格"
            fullWidth
            multiline
            rows={2}
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="背景"
            fullWidth
            multiline
            rows={3}
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            label="关系 (JSON格式)"
            fullWidth
            multiline
            rows={3}
            value={relationships}
            onChange={(e) => setRelationships(e.target.value)}
            placeholder='{"张三": "朋友", "李四": "同事"}'
            helperText="例如: {&quot;张三&quot;: &quot;朋友&quot;, &quot;李四&quot;: &quot;同事&quot;}"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!name.trim()}>
            {editMode ? '保存' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
