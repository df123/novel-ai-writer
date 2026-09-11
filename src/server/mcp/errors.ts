// MCP 错误映射：DomainError → 标准 MCP 错误码，不泄露 stack trace
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { DomainError } from '../services/domain/errors';

/** MCP 标准错误码与领域错误码的对应关系 */
function toMcpCode(code: string): ErrorCode {
  switch (code) {
    case 'INVALID_ARGUMENT':
      return ErrorCode.InvalidParams;
    case 'NOT_FOUND':
    case 'CONFLICT':
      return ErrorCode.InternalError; // 业务性失败走 tool error 语义，见 toToolErrorText
    case 'UNAUTHORIZED':
      return ErrorCode.InternalError;
    default:
      return ErrorCode.InternalError;
  }
}

/**
 * 将领域错误转为 MCP Tool 调用内的可恢复错误文本
 * 工具执行失败以 isError=true 的 CallToolResult 返回，让模型能读到修复提示
 */
export function toToolErrorText(error: unknown): string {
  if (error instanceof DomainError) {
    const hint = error.recoveryHint ? ` ${error.recoveryHint}` : '';
    return `[${error.code}] ${error.message}${hint}`;
  }
  console.error('MCP tool internal error:', error);
  return '[INTERNAL_ERROR] Internal server error. Retry later.';
}

/** 供传输层使用的 McpError 转换（协议级错误） */
export function toMcpError(error: unknown): McpError {
  if (error instanceof DomainError) {
    return new McpError(toMcpCode(error.code), toToolErrorText(error));
  }
  return new McpError(ErrorCode.InternalError, 'Internal server error');
}
