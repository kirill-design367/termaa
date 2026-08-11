/** Префикс выдачи. В боевой сборке — /termaa, в dev может быть пустым. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/** Абсолютный путь к статике с учётом basePath. */
export const A = (path: string) => `${BASE}${path}`
