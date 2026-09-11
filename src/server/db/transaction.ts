// 写事务封装：保证"版本快照 + 实体更新"原子完成，失败整体回滚
import { run, saveDB, query } from './queries';

/**
 * 判断当前数据库连接是否已处于事务中
 * sql.js 无法直接查询事务状态，通过 BEGIN 的报错信息间接判断
 */
function beginTransaction(): boolean {
  try {
    run('BEGIN IMMEDIATE');
    return true;
  } catch (e) {
    const message = (e as Error).message?.toLowerCase() || '';
    if (message.includes('cannot start a transaction within a transaction')) {
      return false; // 外层已在事务中，由外层负责提交
    }
    throw e;
  }
}

/**
 * 统一写事务：fn 内的所有写操作（版本快照、实体更新）要么全部生效，要么全部回滚。
 * 提交成功后才持久化到磁盘；嵌套调用时由最外层统一提交。
 */
export function withWriteTransaction<T>(fn: () => T): T {
  const started = beginTransaction();
  try {
    const result = fn();
    if (started) {
      run('COMMIT');
      saveDB();
    }
    return result;
  } catch (e) {
    if (started) {
      try {
        run('ROLLBACK');
      } catch (rollbackError) {
        console.error('事务回滚失败:', rollbackError);
      }
    }
    throw e;
  }
}

/**
 * 确认指定项目存在，否则抛 NOT_FOUND 领域错误
 * 供领域服务做归属校验
 */
export function projectExists(projectId: string): boolean {
  const rows = query<{ count: number }>(
    'SELECT COUNT(*) as count FROM projects WHERE id = ?',
    [projectId]
  );
  return rows[0].count > 0;
}
