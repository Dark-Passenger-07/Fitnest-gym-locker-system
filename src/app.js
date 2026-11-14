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

// Route modules
const membersRoutes = require("./routes/members.routes");
const lockersRoutes = require("./routes/lockers.routes");
const allotmentsRoutes = require("./routes/allotments.routes");
const auditRoutes = require("./routes/audit.routes");

const app = express();

// Common JSON body parser middleware
app.use(express.json());

// Mount route modules at exact shared contract paths
app.use("/api/members", membersRoutes);
app.use("/api/lockers", lockersRoutes);
app.use("/api/allotments", allotmentsRoutes);
app.use("/api/audit", auditRoutes);

// 404 handler for unknown routes
app.use(notFound);

// Central error handler
app.use(errorHandler);

module.exports = app;
