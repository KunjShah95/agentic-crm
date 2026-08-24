export class AppError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.status = status
  }
}

/** Thrown when the caller lacks permission — maps to a 403 response. */
export class PermissionError extends AppError {
  constructor(message = "You don't have permission to do that.") {
    super("FORBIDDEN", message, 403)
    this.name = "PermissionError"
  }
}

/** Thrown when a resource cannot be found — maps to a 404 response. */
export class NotFoundError extends AppError {
  constructor(message = "That resource could not be found.") {
    super("NOT_FOUND", message, 404)
    this.name = "NotFoundError"
  }
}
