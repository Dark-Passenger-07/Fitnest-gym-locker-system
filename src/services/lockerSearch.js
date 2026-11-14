"use strict";

/**
 * lockerSearch.js
 * Nevanesh – Reusable Floor-Search Service
 *
 * Implements floor-based filtering and listing for lockers.
 * Supports parameterized SQL queries to prevent SQL injection.
 * Returns an array containing locker records with fields: id, name, floor, status.
 */

// Attempt to load shared database connection if available
let defaultDb = null;
try {
  defaultDb = require("../db/database");
} catch {
  // Gracefully handle environments where database.js is not yet merged
}

/**
 * Retrieves lockers filtered optionally by floor.
 *
 * @param {import("better-sqlite3").Database|string} [dbOrFloor] - Target DB instance or optional floor if DB omitted
 * @param {string} [maybeFloor] - Optional floor when DB is passed as first argument
 * @returns {Array<{id: number, name: string, floor: string, status: string}>} Array of lockers ordered by id ASC
 */
function getLockers(dbOrFloor, maybeFloor) {
  let targetDb;
  let floor;

  // Polymorphic signature handling:
  // Signature 1: getLockers(db, floor)
  // Signature 2: getLockers(floor) - uses shared defaultDb
  if (dbOrFloor && typeof dbOrFloor.prepare === "function") {
    targetDb = dbOrFloor;
    floor = maybeFloor;
  } else {
    targetDb = defaultDb;
    floor = dbOrFloor;
  }

  if (!targetDb) {
    throw new Error(
      "Database connection not found. Pass db explicitly or ensure src/db/database.js exists."
    );
  }

  // If floor is not provided or null, return all lockers ordered by ID ascending
  if (floor === undefined || floor === null) {
    const stmt = targetDb.prepare(
      "SELECT id, name, floor, status FROM lockers ORDER BY id ASC"
    );
    return stmt.all();
  }

  if (typeof floor !== "string") {
    throw new TypeError("Floor parameter must be a string if provided.");
  }

  const trimmedFloor = floor.trim();

  // If floor is empty or whitespace-only, return empty array (or specific validation outcome)
  if (trimmedFloor.length === 0) {
    return [];
  }

  // Parameterized query: never concatenate user input into SQL
  const stmt = targetDb.prepare(
    "SELECT id, name, floor, status FROM lockers WHERE floor = ? ORDER BY id ASC"
  );
  return stmt.all(trimmedFloor);
}

/**
 * Convenience helper aligned with Manvith's locker controller convention.
 *
 * @param {string} floor - Floor to filter by
 * @param {import("better-sqlite3").Database} [db] - Optional DB instance
 * @returns {Array<{id: number, name: string, floor: string, status: string}>}
 */
function searchByFloor(floor, db) {
  return getLockers(db, floor);
}

module.exports = {
  getLockers,
  searchByFloor,
};
