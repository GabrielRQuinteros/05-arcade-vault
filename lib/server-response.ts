/** Formato único de respuesta de los endpoints del servidor. */
export interface ServerResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  message: string | null;
}

export const createServerResponse = <T>(
  ok: boolean,
  status: number,
  data: T | null,
  message: string | null,
): ServerResponse<T> => {
  return { ok, status, data, message };
};
