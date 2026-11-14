"use strict";

/**
 * lockerAudit.service.js
 * Manvith – Locker CRUD & Audit Service
 *
 * Provides atomic better-sqlite3 transactions that pair every locker
 * mutation with exactly one audit row in locker_audit.
 * If either statement fails the whole transaction is rolled back.
 */

const db = require("../db/database");

/**
 * Insert a new locker and immediately write a CREATE audit row,
 * all inside one SQLite transaction.
 *
 * @param {string} name   – locker name (already trimmed / validated)
 * @param {string} floor  – floor label (already trimmed / validated)
 * @returns {{ id, name, floor, status }} – the newly created locker row
 */
function createLockerWithAudit(name, floor) {
  const txn = db.transaction(() => {
    const insert = db.prepare(
      `INSERT INTO lockers (name, floor, status) VALUES (?, ?, 'AVAILABLE')`
    );
    const info = insert.run(name, floor);
    const lockerId = info.lastInsertRowid;

    db.prepare(
      `INSERT INTO locker_audit (action, locker_id) VALUES ('CREATE', ?)`
    ).run(lockerId);

    return db.prepare(`SELECT * FROM lockers WHERE id = ?`).get(lockerId);
  });

  return txn();
}

/**
 * Update an existing locker and write an UPDATE audit row atomically.
 *
 * @param {number} id     – locker primary key
 * @param {string} name   – new name
 * @param {string} floor  – new floor
 * @returns {{ id, name, floor, status } | null} – updated locker or null if not found
 */
function updateLockerWithAudit(id, name, floor) {
  const txn = db.transaction(() => {
    const result = db.prepare(
      `UPDATE lockers SET name = ?, floor = ? WHERE id = ?`
    ).run(name, floor, id);

    if (result.changes === 0) {
      return null; // locker did not exist
    }

    db.prepare(
      `INSERT INTO locker_audit (action, locker_id) VALUES ('UPDATE', ?)`
    ).run(id);

    return db.prepare(`SELECT * FROM lockers WHERE id = ?`).get(id);
  });

  return txn();
}

/**
 * Delete an existing locker and write a DELETE audit row atomically.
 * The audit row intentionally has no FK to lockers so it survives deletion.
 *
 * @param {number} id – locker primary key
 * @returns {{ deleted: true } | null | 'REFERENCED'}
 *   null       – locker not found
 *   'REFERENCED' – FK constraint prevented deletion
 *   { deleted: true } – success
 */
function deleteLockerWithAudit(id) {
  const txn = db.transaction(() => {
    // Confirm the locker exists before attempting deletion
    const existing = db.prepare(`SELECT id FROM lockers WHERE id = ?`).get(id);
    if (!existing) {
      return null;
    }

    // Write the audit row BEFORE deleting (locker_id captured here)
    db.prepare(
      `INSERT INTO locker_audit (action, locker_id) VALUES ('DELETE', ?)`
    ).run(id);

    // Attempt deletion – FK violation will throw if allotments reference it
    db.prepare(`DELETE FROM lockers WHERE id = ?`).run(id);

    return { deleted: true };
  });

  try {
    return txn();
  } catch (err) {
    // SQLite FK violation error codes / messages
    if (
      err.code === "SQLITE_CONSTRAINT_FOREIGNKEY" ||
      err.code === "SQLITE_CONSTRAINT" ||
      (err.message && err.message.includes("FOREIGN KEY"))
    ) {
      return "REFERENCED";
    }
    throw err; // propagate unexpected errors
  }
}

/**
 * Retrieve the latest (up to 10) audit rows, newest first.
 *
 * @returns {Array<{ action, locker_id, time }>}
 */
function getLatestAudit() {
  return db
    .prepare(
      `SELECT action, locker_id, time
       FROM locker_audit
       ORDER BY id DESC
       LIMIT 10`
    )
    .all();
}

module.exports = {
  createLockerWithAudit,
  updateLockerWithAudit,
  deleteLockerWithAudit,
  getLatestAudit,
};
