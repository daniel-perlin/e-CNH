import type { StructuredLogger } from '../types/logger.js';

/**
 * Nomes estáveis das etapas pós-login (logs).
 * Não alteram comportamento — apenas observabilidade.
 */
export const PIPELINE_STEPS = {
  RESOLVE_PERFIL_POS_LOGIN: 'RESOLVE_PERFIL_POS_LOGIN',
  LIST_DATAS_AGENDAMENTO: 'LIST_DATAS_AGENDAMENTO',
  FETCH_AGENDA_HTML: 'FETCH_AGENDA_HTML',
  PARSE_AGENDA_HTML: 'PARSE_AGENDA_HTML',
  TRANSFORM_AGENDA_DATA: 'TRANSFORM_AGENDA_DATA',
  PERSIST_AGENDA: 'PERSIST_AGENDA',
  SHEETS_LER_MATRIZ: 'SHEETS_LER_MATRIZ',
  SHEETS_TRANSFORMAR: 'SHEETS_TRANSFORMAR',
  SHEETS_REESCREVER: 'SHEETS_REESCREVER',
  LOGOUT: 'LOGOUT'
} as const;

export type PipelineStepName = (typeof PIPELINE_STEPS)[keyof typeof PIPELINE_STEPS];

/** Serializa erro para logs estruturados (sem PII/segredos). */
export function serializarErroObservabilidade(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const nodeError = error as NodeJS.ErrnoException;
  const cause =
    error.cause instanceof Error
      ? {
          name: error.cause.name,
          message: error.cause.message,
          stack: error.cause.stack,
          code: (error.cause as NodeJS.ErrnoException).code
        }
      : error.cause !== undefined
        ? { message: String(error.cause) }
        : undefined;

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: nodeError.code,
    cause
  };
}

/**
 * Rastreador de etapas do pipeline pós-login.
 * Mantém `lastSuccessfulPipelineStep` para identificar a última etapa OK antes da falha.
 */
export class PipelineStepTracker {
  private currentStep: string | undefined;
  private lastSuccessfulStep: string | undefined;

  public constructor(
    private readonly logger: StructuredLogger | undefined,
    private readonly baseBindings: Record<string, unknown> = {}
  ) {}

  public get currentPipelineStep(): string | undefined {
    return this.currentStep;
  }

  public get lastSuccessfulPipelineStep(): string | undefined {
    return this.lastSuccessfulStep;
  }

  public start(pipelineStep: string, extra: Record<string, unknown> = {}): number {
    this.currentStep = pipelineStep;
    this.logger?.warn(
      {
        event: 'agenda.pipeline.step.start',
        pipelineStep,
        lastSuccessfulPipelineStep: this.lastSuccessfulStep,
        ...this.baseBindings,
        ...extra
      },
      'Etapa do pipeline pós-login iniciada'
    );
    return Date.now();
  }

  public complete(
    pipelineStep: string,
    startedAt: number,
    extra: Record<string, unknown> = {}
  ): void {
    const durationMs = Date.now() - startedAt;
    this.lastSuccessfulStep = pipelineStep;
    this.currentStep = undefined;
    this.logger?.warn(
      {
        event: 'agenda.pipeline.step.completed',
        pipelineStep,
        lastSuccessfulPipelineStep: this.lastSuccessfulStep,
        durationMs,
        ...this.baseBindings,
        ...extra
      },
      'Etapa do pipeline pós-login concluída'
    );
  }

  public fail(
    pipelineStep: string,
    startedAt: number,
    error: unknown,
    extra: Record<string, unknown> = {}
  ): void {
    const durationMs = Date.now() - startedAt;
    this.logger?.error(
      {
        event: 'agenda.pipeline.step.failed',
        pipelineStep,
        lastSuccessfulPipelineStep: this.lastSuccessfulStep,
        durationMs,
        error: serializarErroObservabilidade(error),
        ...this.baseBindings,
        ...extra
      },
      'Etapa do pipeline pós-login falhou'
    );
  }

  /**
   * Executa uma etapa com início/fim/duração; propaga o erro após registrar.
   */
  public async run<T>(
    pipelineStep: string,
    fn: () => Promise<T> | T,
    options: {
      onStart?: Record<string, unknown>;
      onSuccess?: (result: T) => Record<string, unknown>;
    } = {}
  ): Promise<T> {
    const startedAt = this.start(pipelineStep, options.onStart);
    try {
      const result = await fn();
      this.complete(pipelineStep, startedAt, options.onSuccess?.(result) ?? {});
      return result;
    } catch (error) {
      this.fail(pipelineStep, startedAt, error);
      throw error;
    }
  }

  public flowFailed(reason: string, extra: Record<string, unknown> = {}): void {
    this.logger?.error(
      {
        event: 'agenda.pipeline.flow.failed',
        reason,
        pipelineStep: this.currentStep,
        lastSuccessfulPipelineStep: this.lastSuccessfulStep,
        ...this.baseBindings,
        ...extra
      },
      'Pipeline pós-login interrompido'
    );
  }

  public flowCompleted(extra: Record<string, unknown> = {}): void {
    this.logger?.warn(
      {
        event: 'agenda.pipeline.flow.completed',
        lastSuccessfulPipelineStep: this.lastSuccessfulStep,
        ...this.baseBindings,
        ...extra
      },
      'Pipeline pós-login concluído para o profissional'
    );
  }
}
