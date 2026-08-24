import { Prisma } from "@/lib/generated/prisma/client"
import { AppError } from "@/lib/errors"

export type ApiError = {
  code: string
  message: string
}

export type Result<T> = { data: T; error?: never } | { data?: never; error: ApiError }

/**
 * Wraps a server-action body so it always resolves to a { data, error } union
 * instead of throwing to the client. Known errors (AppError) keep their code;
 * Prisma errors are logged server-side and surfaced generically; anything else
 * (including next/navigation redirects) is re-thrown.
 */
export async function handleAction<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { data: await fn() }
  } catch (err) {
    if (err instanceof AppError) {
      return { error: { code: err.code, message: err.message } }
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[db]", err.code, err.message)
      return {
        error: {
          code: "DB_ERROR",
          message:
            err.code === "P2002"
              ? "That already exists. Try a different value."
              : "Something went wrong while saving. Please try again.",
        },
      }
    }
    // Unknown errors (including redirect()) propagate to the framework.
    throw err
  }
}
