export interface StructuredLogger {
  debug(bindings: object, message?: string): void;
  error(bindings: object, message?: string): void;
  info(bindings: object, message?: string): void;
  warn(bindings: object, message?: string): void;
}
