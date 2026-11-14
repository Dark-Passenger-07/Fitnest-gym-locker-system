"use strict";

/**
 * server.js
 * FitNest Gym Locker Management System - Server Startup Entrypoint
 *
 * Owned by Aravind (Team Lead).
 * Initializes the SQLite database before listening on process.env.PORT || 3000.
 */

const app = require("./app");
const { initDatabase } = require("./db/init");

const PORT = process.env.PORT || 3000;

try {
  // Initialize database schema idempotently before starting listener
  initDatabase();
  console.log("Database initialized successfully.");

  app.listen(PORT, () => {
    console.log(`FitNest Locker Management server running on http://localhost:${PORT}`);
  });
} catch (err) {
  console.error("Failed to initialize database or start server:", err);
  process.exit(1);
}

