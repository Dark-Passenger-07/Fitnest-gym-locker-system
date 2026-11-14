"use strict";

/**
 * lockerValidation.js
 * Nevanesh – Reusable Locker Input Validation Middleware
 *
 * Validates request payload for POST /api/lockers and PUT /api/lockers/:id.
 * Enforces non-empty string name and floor after trimming,
 * updates req.body with trimmed strings, and returns HTTP 400 with clear error
 * messages on invalid input.
 */

function validateLocker(req, res, next) {
  try {
    const body = req.body;

    // Body must be a non-null, non-array object
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ error: "Request body must be a valid JSON object." });
    }

    const { name, floor } = body;

    // 1. Validate 'name'
    if (name === undefined || name === null) {
      return res.status(400).json({ error: "Locker name is required." });
    }

    if (typeof name !== "string") {
      return res.status(400).json({ error: "Locker name must be a string." });
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return res.status(400).json({ error: "Locker name cannot be empty or whitespace only." });
    }

    // 2. Validate 'floor'
    if (floor === undefined || floor === null) {
      return res.status(400).json({ error: "Floor is required." });
    }

    if (typeof floor !== "string") {
      return res.status(400).json({ error: "Floor must be a string." });
    }

    const trimmedFloor = floor.trim();
    if (trimmedFloor.length === 0) {
      return res.status(400).json({ error: "Floor cannot be empty or whitespace only." });
    }

    // Store trimmed values back onto req.body for downstream controllers
    req.body.name = trimmedName;
    req.body.floor = trimmedFloor;

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  validateLocker,
};
