"use strict";

/**
 * allotments.controller.js
 * Nevanesh – Allotment Controller
 *
 * Implements GET /api/allotments:
 * Joins allotments, members, and lockers tables using an INNER JOIN.
 * Returns HTTP 200 with an array of joined allotment objects,
 * or an empty array if no allotments exist.
 *
 * Response fields:
 * - id
 * - member_id
 * - member_name
 * - locker_id
 * - locker_name
 * - floor
 * - allotted_at
 * - returned_at
 */

const db = require("../db/database");

async function getAllAllotments(req, res, next) {
  try {
    const activeDb = (req && req.app && req.app.locals && req.app.locals.db) || db;
    if (!activeDb) {
      throw new Error("Database connection is not available.");
    }

    const query = `
      SELECT 
        a.id AS id,
        a.member_id AS member_id,
        m.name AS member_name,
        a.locker_id AS locker_id,
        l.name AS locker_name,
        l.floor AS floor,
        a.allotted_at AS allotted_at,
        a.returned_at AS returned_at
      FROM allotments a
      INNER JOIN members m ON a.member_id = m.id
      INNER JOIN lockers l ON a.locker_id = l.id
      ORDER BY a.id ASC
    `;

    const allotments = activeDb.prepare(query).all();
    return res.status(200).json(allotments);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllAllotments,
};
