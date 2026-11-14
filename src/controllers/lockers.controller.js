"use strict";

/**
 * lockers.controller.js
 * Manvith – Locker CRUD controller
 *
 * Owns: GET /api/lockers, GET /api/lockers/:id,
 *       POST /api/lockers, PUT /api/lockers/:id, DELETE /api/lockers/:id
 *
 * All locker mutations go through lockerAudit.service.js so that
 * the locker row and its audit entry are written in one transaction.
 *
 * Floor filtering is delegated to Nevanesh's lockerSearch.js service.
 * Validation middleware (validateLocker) is Nevanesh's lockerValidation.js,
 * applied at the route level.
 */

const db = require("../db/database");
const auditService = require("../services/lockerAudit.service");
const lockerSearch = require("../services/lockerSearch");

// ---------------------------------------------------------------------------
// Helper: parse and validate a positive-integer route param
// ---------------------------------------------------------------------------
function parseId(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

// ---------------------------------------------------------------------------
// GET /api/lockers?floor=<optional>
// ---------------------------------------------------------------------------
async function getAllLockers(req, res, next) {
  try {
    const { floor } = req.query;

    if (floor !== undefined) {
      const lockers = lockerSearch.getLockers(floor);
      return res.status(200).json(lockers);
    }

    const lockers = db.prepare(`SELECT * FROM lockers ORDER BY id ASC`).all();
    return res.status(200).json(lockers);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/lockers/:id
// ---------------------------------------------------------------------------
async function getLockerById(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "ID must be a positive integer." });
    }

    const locker = db.prepare(`SELECT * FROM lockers WHERE id = ?`).get(id);
    if (!locker) {
      return res.status(404).json({ error: `Locker with ID ${id} not found.` });
    }

    return res.status(200).json(locker);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/lockers
// (validateLocker middleware runs first – attached in routes file)
// ---------------------------------------------------------------------------
async function createLocker(req, res, next) {
  try {
    const name = req.body.name.trim();
    const floor = req.body.floor.trim();

    const locker = auditService.createLockerWithAudit(name, floor);
    return res.status(201).json(locker);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/lockers/:id
// (validateLocker middleware runs first – attached in routes file)
// ---------------------------------------------------------------------------
async function updateLocker(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "ID must be a positive integer." });
    }

    const name = req.body.name.trim();
    const floor = req.body.floor.trim();

    const locker = auditService.updateLockerWithAudit(id, name, floor);
    if (locker === null) {
      return res.status(404).json({ error: `Locker with ID ${id} not found.` });
    }

    return res.status(200).json(locker);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/lockers/:id
// ---------------------------------------------------------------------------
async function deleteLocker(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "ID must be a positive integer." });
    }

    const result = auditService.deleteLockerWithAudit(id);

    if (result === null) {
      return res.status(404).json({ error: `Locker with ID ${id} not found.` });
    }

    if (result === "REFERENCED") {
      return res.status(409).json({
        error:
          "Cannot delete locker: it is referenced by existing allotment history. " +
          "Return or close allotments before attempting deletion.",
      });
    }

    return res.status(200).json({ message: `Locker ${id} deleted successfully.` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllLockers,
  getLockerById,
  createLocker,
  updateLocker,
  deleteLocker,
};
