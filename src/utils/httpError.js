export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const notFound = (message = "Resource not found") => {
  throw new HttpError(404, message);
};
