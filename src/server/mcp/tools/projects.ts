// MCP 工具：项目管理（不含删除，避免整本小说被误删）
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runTool } from '../server';
import { toolOk, summarizeList } from '../result';
import * as projectService from '../../services/domain/projectService';
import { listProjectsInput, getProjectInput, createProjectInput, updateProjectInput } from '../schemas/entities';
import { listProjectsOutput, projectByIdOutput } from '../schemas/output';

const READ_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const WRITE_ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

export function registerProjectTools(server: McpServer): void {
  server.registerTool('list_projects', {
    title: 'List novel projects',
    description: 'List all novel projects with id, title, description and updated_at. Start here to resolve a project_id.',
    inputSchema: listProjectsInput,
    outputSchema: listProjectsOutput,
    annotations: READ_ANNOTATIONS
  }, async () => runTool('list_projects', undefined, () => {
    const projects = projectService.listProjects();
    return toolOk({ projects }, summarizeList(projects, 'projects'));
  }));

  server.registerTool('get_project', {
    title: 'Get project',
    description: 'Get one novel project by UUID.',
    inputSchema: getProjectInput,
    outputSchema: projectByIdOutput,
    annotations: READ_ANNOTATIONS
  }, async ({ project_id }) => runTool('get_project', project_id as string, () => {
    const project = projectService.getProject(project_id);
    return toolOk({ project }, `Project "${project.title}".`);
  }));

  server.registerTool('create_project', {
    title: 'Create project',
    description: 'Create a new novel project. Only create when the user starts a brand-new novel.',
    inputSchema: createProjectInput,
    outputSchema: projectByIdOutput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ title, description }) => runTool('create_project', undefined, () => {
    const project = projectService.createProject({ title, description });
    return toolOk({ project }, `Created project "${project.title}" (${project.id}).`);
  }));

  server.registerTool('update_project', {
    title: 'Update project',
    description: 'Update a project title/description. Pass expected_updated_at from your last read to avoid overwriting concurrent changes.',
    inputSchema: updateProjectInput,
    outputSchema: projectByIdOutput,
    annotations: WRITE_ANNOTATIONS
  }, async ({ project_id, title, description, expected_updated_at }) =>
    runTool('update_project', project_id, () => {
      const project = projectService.updateProject(project_id, { title, description }, { expectedUpdatedAt: expected_updated_at });
      return toolOk({ project }, `Updated project "${project.title}".`);
    })
  );
}
