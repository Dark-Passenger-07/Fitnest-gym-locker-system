"use strict";

/**
 * members.controller.js
 * Aravind – Members controller
 *
 * Implements:
 *   GET  /api/members      - List all members
 *   GET  /api/members/:id  - Get a single member by ID
 *   POST /api/members      - Create a new member
 */

const db = require("../db/database");

/**
 * Validates that an input is a positive integer.
 * Returns the parsed integer or null if invalid.
 */
function parsePositiveInteger(raw) {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

/**
 * GET /api/members
 * Returns all members, HTTP 200.
 */
function getAllMembers(req, res, next) {
  try {
    const stmt = db.prepare("SELECT id, name, email FROM members ORDER BY id ASC");
    const members = stmt.all();
    return res.status(200).json(members);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/members/:id
 * Returns one member, 200; absent member 404; malformed ID 400.
 */
function getMemberById(req, res, next) {
  try {
    const id = parsePositiveInteger(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "ID must be a positive integer." });
    }

    const stmt = db.prepare("SELECT id, name, email FROM members WHERE id = ?");
    const member = stmt.get(id);

    if (!member) {
      return res.status(404).json({ error: `Member with ID ${id} not found.` });
    }

    return res.status(200).json(member);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/members
 * Accepts name and optional email.
 * Requires a non-empty trimmed name; returns 201 on success; 400 on invalid input;
 * 409 for duplicate email.
 */
function createMember(req, res, next) {
  try {
    const { name, email } = req.body || {};

    // Validate name
    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Name is required and must be a non-empty string." });
    }
    const trimmedName = name.trim();

    // Validate optional email
    let trimmedEmail = null;
    if (email !== undefined && email !== null) {
      if (typeof email !== "string") {
        return res.status(400).json({ error: "Email must be a string." });
      }
      const cleanEmail = email.trim();
      trimmedEmail = cleanEmail !== "" ? cleanEmail : null;
    }

    const insertStmt = db.prepare("INSERT INTO members (name, email) VALUES (?, ?)");
    const info = insertStmt.run(trimmedName, trimmedEmail);

    const getStmt = db.prepare("SELECT id, name, email FROM members WHERE id = ?");
    const createdMember = getStmt.get(info.lastInsertRowid);

    return res.status(201).json(createdMember);
  } catch (err) {
    if (
      err.code === "SQLITE_CONSTRAINT_UNIQUE" ||
      (err.message && err.message.includes("UNIQUE constraint failed"))
    ) {
      return res.status(409).json({ error: "A member with this email already exists." });
    }
    next(err);
  }
}

module.exports = {
  getAllMembers,
  getMemberById,
  createMember,
  parsePositiveInteger,
};
