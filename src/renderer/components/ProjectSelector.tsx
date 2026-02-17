import React from 'react';
import { Select, MenuItem, FormControl, InputLabel, Typography, Box } from '@mui/material';
import { useProjectStore } from '../store/projectStore';

export default function ProjectSelector() {
  const { projects, currentProject, selectProject } = useProjectStore();

  if (projects.length === 0) {
    return null;
  }

  return (
    <Box sx={{ minWidth: 200, ml: 2 }}>
      <FormControl size="small" fullWidth>
        <InputLabel>项目</InputLabel>
        <Select
          value={currentProject?.id || ''}
          label="项目"
          onChange={(e) => selectProject(e.target.value as string)}
        >
          {projects.map((project) => (
            <MenuItem key={project.id} value={project.id}>
              <Typography noWrap>{project.title}</Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
