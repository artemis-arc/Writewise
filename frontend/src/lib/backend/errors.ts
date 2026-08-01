/** Raised by backend/* clients so route handlers can forward the real HTTP status (e.g. 401). */
export class BackendHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BackendHttpError";
  }
}
