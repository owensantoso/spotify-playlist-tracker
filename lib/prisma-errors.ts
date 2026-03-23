import { Prisma } from "@prisma/client";

export function isDatabaseUnavailableError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001" || error.code === "P1008" || error.code === "P1017";
  }

  return (
    error instanceof Error &&
    [
      "Failed to connect to upstream database",
      "Can't reach database server",
      "Server has closed the connection",
      "Connection terminated unexpectedly",
    ].some((pattern) => error.message.includes(pattern))
  );
}
