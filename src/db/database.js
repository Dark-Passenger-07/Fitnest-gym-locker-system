"use strict";

/**
 * database.js
 * FitNest Gym Locker Management System - Shared SQLite Database Connection
 *
 * Owned by Akshay (Database Engineer).
 * 
 * Provides a single, shared better-sqlite3 database connection instance
 * for the entire application with SQLite foreign keys enabled.
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Ensure the data/ directory exists safely
const dataDir = path.resolve(__dirname, "../../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "fitnest.db");

// Open exactly one SQLite database instance
const db = new Database(dbPath);

// Enforce foreign key constraints at connection level
db.pragma("foreign_keys = ON");

module.exports = db;
