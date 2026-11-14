"use strict";

/**
 * lockerSearch.js
 * Nevanesh – Reusable Floor-Search Service
 *
 * Implements floor-based filtering and listing for lockers.
 * Supports parameterized SQL queries to prevent SQL injection.
 * Returns an array containing locker records with fields: id, name, floor, status.
 */

const defaultDb = require("../db/database");

/**
 * Retrieves lockers filtered optionally by floor.
 * Supports flexible parameter signatures:
 *   getLockers() -> all lockers using shared db
 *   getLockers(floor) -> filtered lockers using shared db
 *   getLockers(db, floor) -> filtered lockers using custom db
 *   getLockers(floor, db) -> filtered lockers using custom db
 *
 * @param {import("better-sqlite3").Database|string} [arg1] - Database instance or floor string
 * @param {import("better-sqlite3").Database|string} [arg2] - Floor string or database instance
 * @returns {Array<{id: number, name: string, floor: string, status: string}>} Array of lockers ordered by id ASC
 */
function getLockers(arg1, arg2) {
  let targetDb = defaultDb;
  let floor = undefined;

  // Differentiate db instance vs floor string in arguments
  if (arg1 && typeof arg1.prepare === "function") {
    targetDb = arg1;
    floor = arg2;
  } else if (arg2 && typeof arg2.prepare === "function") {
    targetDb = arg2;
    floor = arg1;
  } else {
    floor = arg1;
  }

  if (!targetDb) {
    throw new Error(
      "Database connection not found. Ensure src/db/database.js exists or pass db explicitly."
    );
  }

  // If floor is omitted or null, return all lockers ordered by ID ascending
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

  // If floor is empty or whitespace-only, return empty array
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
  return getLockers(floor, db);
}

module.exports = {
  getLockers,
  searchByFloor,
};
