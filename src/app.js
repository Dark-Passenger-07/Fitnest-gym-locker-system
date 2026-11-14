"use strict";

/**
 * app.js
 * FitNest Gym Locker Management System - Express Application Setup
 *
 * Owned by Aravind (Team Lead).
 * Constructs and exports the Express app without starting the listener.
 */

const express = require("express");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

// Own routes
const membersRoutes = require("./routes/members.routes");

// Safe loader for teammate route modules during distributed development
// Allows app.js to be imported and tested before all teammate branches are merged
function loadRoute(modulePath) {
  try {
    return require(modulePath);
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      return null;
    }
    throw err;
  }
}

const lockersRoutes = loadRoute("./routes/lockers.routes");
const allotmentsRoutes = loadRoute("./routes/allotments.routes");
const auditRoutes = loadRoute("./routes/audit.routes");

const app = express();

// Common middleware
app.use(express.json());

// Mount route modules at exact contract paths
app.use("/api/members", membersRoutes);
if (lockersRoutes) {
  app.use("/api/lockers", lockersRoutes);
}
if (allotmentsRoutes) {
  app.use("/api/allotments", allotmentsRoutes);
}
if (auditRoutes) {
  app.use("/api/audit", auditRoutes);
}

// 404 handler for unknown routes
app.use(notFound);

// Central error handler
app.use(errorHandler);

module.exports = app;
