// Never serialize Error.message, meta, cause or stack: ORM errors may embed input values.
export function safeError(error: unknown) {
  const e = error as { name?: unknown; code?: unknown } | null;
  const errorCode =
    typeof e?.code === 'string' && /^(P\d{4}|FST_ERR_[A-Z_]+)$/.test(e.code) ? e.code : undefined;
  const errorType =
    typeof e?.name === 'string' &&
    /^(Error|TypeError|SyntaxError|ZodError|PrismaClient[A-Za-z]+Error)$/.test(e.name)
      ? e.name
      : 'Error';
  return {
    errorType,
    errorCode,
    message: errorCode?.startsWith('P')
      ? 'Falha de banco de dados'
      : 'Falha interna no processamento',
  };
}
