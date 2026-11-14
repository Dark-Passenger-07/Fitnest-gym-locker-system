"use strict";

/**
 * init.js
 * FitNest Gym Locker Management System - Idempotent Schema Initializer
 *
 * Owned by Akshay (Database Engineer).
 *
 * Creates the four agreed tables, partial unique indexes, foreign key
 * relationships, and performance indexes safely and idempotently.
 */

const defaultDb = require("./database");

/**
 * Idempotently initializes the database schema.
 * Safe to run multiple times without corrupting or wiping existing data.
 *
 * @param {import("better-sqlite3").Database} [targetDb] - Optional database instance (defaults to shared db)
 */
function initDatabase(targetDb = defaultDb) {
  // Ensure foreign key constraints are enabled on this connection
  targetDb.pragma("foreign_keys = ON");

  // 1. Members Table
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE
    );
  `);

  // 2. Lockers Table
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS lockers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      floor TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE'
    );
  `);

  // Index on floor to optimize GET /api/lockers?floor=... search queries
  targetDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_lockers_floor ON lockers(floor);
  `);

  // 3. Allotments Table
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS allotments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
      locker_id INTEGER NOT NULL REFERENCES lockers(id) ON DELETE RESTRICT,
      allotted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      returned_at TEXT NULL
    );
  `);

  // Partial Unique Index 1: At most one active allotment per locker (returned_at IS NULL)
  targetDb.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_allotments_active_locker
    ON allotments(locker_id)
    WHERE returned_at IS NULL;
  `);

  // Partial Unique Index 2: At most one active allotment per member (returned_at IS NULL)
  targetDb.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_allotments_active_member
    ON allotments(member_id)
    WHERE returned_at IS NULL;
  `);

  // Foreign key lookup indexes for JOIN performance on /api/allotments
  targetDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_allotments_member_id ON allotments(member_id);
    CREATE INDEX IF NOT EXISTS idx_allotments_locker_id ON allotments(locker_id);
  `);

  // 4. Locker Audit Table
  // Intentionally NO foreign key to lockers so audit records survive locker deletion
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS locker_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      locker_id INTEGER NOT NULL,
      time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Index on locker_id in audit log
  targetDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_locker_audit_locker_id ON locker_audit(locker_id);
  `);
}

module.exports = {
  initDatabase,
};
