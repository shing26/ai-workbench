export type WorkbenchErrorCode = 'REQUIRES_CONFIRMATION' | 'PERMISSION_DENIED' | 'GENERIC';

export class WorkbenchError extends Error {
  code: WorkbenchErrorCode;
  rule?: { action?: string; object?: string };
  payload?: unknown;

  constructor(
    code: WorkbenchErrorCode,
    message: string,
    rule?: { action?: string; object?: string },
    payload?: unknown,
  ) {
    super(message);
    this.name = 'WorkbenchError';
    this.code = code;
    this.rule = rule;
    this.payload = payload;
  }
}

const CONFIRM_PREFIX = '__requires_confirmation__:';
const DENY_PREFIX = '__permission_denied__:';

export function parseWorkbenchError(err: unknown): WorkbenchError {
  const message = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  if (message.startsWith(CONFIRM_PREFIX)) {
    const [, action, object] = message.split(':');
    return new WorkbenchError('REQUIRES_CONFIRMATION', 'Operation requires confirmation', {
      action,
      object,
    });
  }
  if (message.startsWith(DENY_PREFIX)) {
    const [, action, object] = message.split(':');
    return new WorkbenchError('PERMISSION_DENIED', 'Operation denied by permission rules', {
      action,
      object,
    });
  }
  return new WorkbenchError('GENERIC', message);
}
