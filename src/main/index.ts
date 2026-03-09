const electron = require('electron');
const path = require('path');
const { registerIPCHandlers } = require('./ipc/handlers');
const { closeDatabase } = require('./database');

const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const Menu = electron.Menu;

let mainWindow: any = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(process.cwd(), 'dist', 'preload', 'index.js'),
    },
    titleBarStyle: 'default',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3001');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(process.cwd(), 'dist', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu(): void {
  const template: any[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建项目',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu:new-project');
          },
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow?.webContents.send('menu:save');
          },
        },
        { type: 'separator' },
        {
          label: '导出为Markdown',
          click: () => {
            mainWindow?.webContents.send('menu:export-md');
          },
        },
        {
          label: '导出为文本',
          click: () => {
            mainWindow?.webContents.send('menu:export-txt');
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: '设置',
      submenu: [
        {
          label: 'LLM设置',
          click: () => {
            mainWindow?.webContents.send('menu:llm-settings');
          },
        },
      ],
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  registerIPCHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  closeDatabase();
});
