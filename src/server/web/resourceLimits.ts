// 高成本资源并发控制（设计书 §25/§28/§30）：LLM=2、语音=2、ComfyUI=1
// 忙时 429 + Retry-After，不引入任务队列
export class ResourceBusyError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('服务忙，请稍后重试');
    this.name = 'ResourceBusyError';
  }
}

class Semaphore {
  private active = 0;

  constructor(private readonly max: number) {}

  /** 立即尝试占用一个槽；成功返回释放函数，失败返回 null（不排队，避免公网滥用堆积） */
  tryAcquire(): (() => void) | null {
    if (this.active >= this.max) return null;
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active = Math.max(0, this.active - 1);
    };
  }
}

const SEMAPHORES: Record<'llm' | 'speech' | 'comfy', { semaphore: Semaphore; retryAfterSeconds: number }> = {
  llm: { semaphore: new Semaphore(2), retryAfterSeconds: 15 },
  speech: { semaphore: new Semaphore(2), retryAfterSeconds: 15 },
  comfy: { semaphore: new Semaphore(1), retryAfterSeconds: 60 }
};

/** 在并发槽内执行 fn；无可用槽立即抛 ResourceBusyError */
export async function withResourceSlot<T>(
  kind: 'llm' | 'speech' | 'comfy',
  fn: () => Promise<T>
): Promise<T> {
  const { semaphore, retryAfterSeconds } = SEMAPHORES[kind];
  const release = semaphore.tryAcquire();
  if (!release) {
    throw new ResourceBusyError(retryAfterSeconds);
  }
  try {
    return await fn();
  } finally {
    release();
  }
}
