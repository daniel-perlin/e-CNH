export class ECNHError extends Error {
  public constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class AuthenticationError extends ECNHError {}

export class AuthenticationProtocolNotConfiguredError extends AuthenticationError {
  public constructor(operation: 'login' | 'logout') {
    super(
      `Não é possível executar ${operation}: o protocolo HTTP do e-CNH ainda não foi confirmado. ` +
        'Consulte docs/API.md e implemente o adaptador após receber a captura autorizada do DevTools.'
    );
  }
}

export class ConfigurationError extends ECNHError {}
