"use strict";

/**
 * errorHandler.js
 * Central error handling middleware.
 * Must be registered as the final middleware with 4 arguments.
 * Consistent error shape: { "error": "..." }
 * Never exposes stack traces to clients.
 */
function errorHandler(err, req, res, next) {
  // If response headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle malformed JSON body from express.json()
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Malformed JSON in request body." });
  }

  // Handle explicit HTTP status errors attached to error object
  if (err.statusCode || err.status) {
    const status = err.statusCode || err.status;
    return res.status(status).json({ error: err.message || "An error occurred." });
  }

  // Handle known SQLite constraint errors
  if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || (err.message && err.message.includes("UNIQUE constraint failed"))) {
    return res.status(409).json({ error: "Resource conflict: a unique constraint was violated." });
  }

  if (err.code === "SQLITE_CONSTRAINT_FOREIGNKEY" || (err.message && err.message.includes("FOREIGN KEY constraint failed"))) {
    return res.status(409).json({ error: "Operation violates foreign key constraints or active references." });
  }

  if (err.code === "SQLITE_CONSTRAINT_NOTNULL" || (err.message && err.message.includes("NOT NULL constraint failed"))) {
    return res.status(400).json({ error: "Required field cannot be null." });
  }

  // Unexpected errors: log server-side and return generic 500 error
  console.error("Unhandled Server Error:", err);
  return res.status(500).json({ error: "Internal server error." });
}

module.exports = errorHandler;
