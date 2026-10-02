let csrf = '';
export const setCsrf = (value: string) => {
  csrf = value;
};
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  extra: Record<string, string> = {},
) {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? 'Falha na requisição');
  return data as T;
}
export const csrfHeaders = () => ({ 'X-CSRF-Token': csrf });
