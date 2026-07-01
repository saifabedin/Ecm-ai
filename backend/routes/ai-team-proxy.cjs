"use strict";
// Transparent proxy to ai-team gateway (localhost:4100).
// In dev mode ai-team accepts unauthenticated calls; in live mode it expects
// a Bearer token which the frontend must supply and we pass through.
const { Router } = require("express");
const axios = require("axios");

const TEAM_BASE = process.env.AI_TEAM_URL || "http://localhost:4100";

const router = Router();

router.all("/*", async (req, res, next) => {
  try {
    const target = `${TEAM_BASE}${req.path}`;
    const params = req.query;
    const headers = { "Content-Type": "application/json" };
    if (req.headers.authorization) headers["Authorization"] = req.headers.authorization;

    const response = await axios({
      method: req.method,
      url: target,
      params,
      data: ["POST", "PUT", "PATCH"].includes(req.method) ? req.body : undefined,
      headers,
      validateStatus: () => true,
    });

    res.status(response.status).json(response.data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
