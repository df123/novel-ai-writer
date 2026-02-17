import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import * as os from 'os';

const DB_PATH = path.join(app.getPath('userData'), 'novel-ai.db');
const DB_BACKUP_PATH = path.join(app.getPath('userData'), 'novel-ai.db-wal');

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;

export async function getDatabase(): Promise<Database> {
  if (!db) {
    await initializeDatabase();
  }
  return db!;
}

async function initializeDatabase(): Promise<void> {
  try {
    SQL = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
    });

    let dbData: Uint8Array | null = null;

    try {
      const data = await fs.readFile(DB_PATH);
      dbData = new Uint8Array(data);
    } catch {
      dbData = null;
    }

    db = new SQL.Database(dbData);
    db.pragma('journal_mode = WAL');

    await createTables();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

async function createTables(): Promise<void> {
  const database = await getDatabase();

  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      deleted INTEGER DEFAULT 0,
      deleted_at INTEGER,
      order_index INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS timeline_nodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT,
      order_index INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      personality TEXT,
      background TEXT,
      relationships TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_prompt TEXT,
      user_prompt_template TEXT,
      variables TEXT,
      is_builtin INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    const data = db.export();
    await fs.writeFile(DB_PATH, Buffer.from(data));
    db.close();
    db = null;
  }
}

export async function saveDatabase(): Promise<void> {
  if (db) {
    const data = db.export();
    await fs.writeFile(DB_PATH, Buffer.from(data));
  }
}
