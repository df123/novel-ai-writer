// 领域层统一错误定义
// REST 层映射为 HTTP 状态码，MCP 层映射为标准错误码，均从这一处派生

/** 领域错误码，与 MCP Tool Error Standard 对齐 */
export type DomainErrorCode =
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

/** HTTP 状态码映射 */
const HTTP_STATUS: Record<DomainErrorCode, number> = {
  INVALID_ARGUMENT: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500
};

/**
 * 领域错误：由 Domain Service 抛出，携带稳定错误码与面向调用方（人或模型）的可恢复提示
 */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  /** 可选的修复提示，告知调用方下一步动作（如重新读取后再更新） */
  readonly recoveryHint?: string;

  constructor(code: DomainErrorCode, message: string, recoveryHint?: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.recoveryHint = recoveryHint;
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code];
  }
}

/** 抛出 NOT_FOUND 领域错误 */
export function notFound(message: string): DomainError {
  return new DomainError('NOT_FOUND', message);
}

/** 抛出 INVALID_ARGUMENT 领域错误 */
export function invalidArgument(message: string): DomainError {
  return new DomainError('INVALID_ARGUMENT', message);
}

/** 抛出 CONFLICT 领域错误（乐观并发冲突） */
export function conflict(message: string, recoveryHint: string): DomainError {
  return new DomainError('CONFLICT', message, recoveryHint);
}

/**
 * 乐观并发检查：expected 与实际 updated_at 不一致时抛 CONFLICT
 * 时间戳为 Unix 秒
 */
export function assertUpdatedAtMatch(
  expected: number | undefined,
  actual: number,
  entityLabel: string
): void {
  if (expected !== undefined && expected !== actual) {
    throw conflict(
      `${entityLabel} was modified after it was read.`,
      `Fetch the latest ${entityLabel.toLowerCase()} (get_story_item) and retry with the new updated_at.`
    );
  }
}
