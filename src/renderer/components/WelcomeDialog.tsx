import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import { useProjectStore } from '../store/projectStore';
import CreateProjectDialog from './CreateProjectDialog';

interface WelcomeDialogProps {
  open?: boolean;
  onClose?: () => void;
}

export default function WelcomeDialog({ open, onClose }: WelcomeDialogProps) {
  const { projects } = useProjectStore();
  const [showCreateProject, setShowCreateProject] = React.useState(false);

  const isOpen = open !== undefined ? open : projects.length === 0;

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>欢迎使用 NovelAI Writer</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" gutterBottom>
              NovelAI Writer 是一款利用大语言模型辅助小说写作的桌面应用。
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              主要功能：
            </Typography>
            <Typography component="ul" sx={{ pl: 3 }}>
              <Typography component="li" variant="body2">
                LLM写作区：与AI助手进行对话，获取写作建议和内容生成
              </Typography>
              <Typography component="li" variant="body2">
                时间线管理：创建和管理小说的时间节点、事件顺序
              </Typography>
              <Typography component="li" variant="body2">
                人物线管理：创建角色设定、关系网络和发展轨迹
              </Typography>
              <Typography component="li" variant="body2">
                上下文注入：自动将时间线和人物信息注入到对话中
              </Typography>
              <Typography component="li" variant="body2">
                导出功能：支持导出为Markdown和文本格式
              </Typography>
            </Typography>
          </Box>
          
          {projects.length === 0 && (
            <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                开始使用
              </Typography>
              <Typography variant="body2" color="text.secondary">
                点击下方按钮创建您的第一个项目，然后在设置中配置LLM API密钥。
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>关闭</Button>
          {projects.length === 0 && (
            <Button onClick={() => setShowCreateProject(true)} variant="contained">
              创建第一个项目
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <CreateProjectDialog
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
      />
    </>
  );
}
