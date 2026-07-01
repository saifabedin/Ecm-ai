/**
 * HyperFrames ESM Loader (Tail-safe for build pipelines)
 *
 * @hyperframes/producer is ESM-only (package.json type: "module").
 * This module accepts either the directory path from package.json or the
 * explicit dist/index.js path, loads the producer via require(), and returns
 * the nested exports. It avoids dynamic imports so a clone/checkout with a
 * missing dist directory (e.g. wrong branch, incomplete install, or just the
 * "source" build artifacts) simply gets a clean null instead of a hard crash.
 */
const path = require("path");

let producer = null;
let producerError = null;
let loadAttempted = false;

function buildCandidatePaths(entry) {
  const resolved = path.resolve("" + entry);
  const candidates = new Set();
  if (!resolved.endsWith(".js") && !resolved.endsWith(".mjs")) {
    candidates.add(path.join(resolved, "dist/index.js"));
    candidates.add(path.join(resolved, "dist/index.mjs"));
  }
  candidates.add(resolved);
  return Array.from(candidates);
}

function loadProducer(entry) {
  if (loadAttempted) return producer;
  loadAttempted = true;

  const candidates = buildCandidatePaths(entry);
  const errors = [];

  for (const candidate of candidates) {
    try {
      const module = require(candidate);
      const exported =
        module?.createRenderJob && module?.executeRenderJob ? module : null;
      if (exported) {
        producer = exported;
        return producer;
      }
      errors.push(
        new Error(
          candidate +
            ": missing createRenderJob/executeRenderJob; keys=" +
            (module ? Object.keys(module).slice(0, 8).join(",") : "<empty>"),
        ),
      );
    } catch (err) {
      if (/Cannot find module|MODULE_NOT_FOUND/.test("" + err)) {
        errors.push(err);
        continue;
      }
      errors.push(err);
      break;
    }
  }

  const last = errors[errors.length - 1];
  producerError = last
    ? new Error(
        "Failed to load @hyperframes/producer from " +
          JSON.stringify(entry) +
          ": " +
          last.message,
      )
    : null;
  return null;
}

function getProducer(entry) {
  if (!producer) loadProducer(entry);
  if (producerError) throw producerError;
  return producer;
}

function getRenderFunctions(entry) {
  // Default entry: resolve from the @hyperframes/producer package location.
  // The producer is ESM-only; the loader normally takes the package directory
  // (or an explicit dist/index.js path). If the caller passes nothing (e.g.
  // the older `await getRenderFunctions()` API), fall back to the installed
  // dist/index.js so we don't crash with "Cannot find module '/undefined'".
  const fallbackEntry = path.resolve(
    __dirname,
    "../../node_modules/@hyperframes/producer",
  );
  const resolvedEntry = entry || fallbackEntry;
  const mod = getProducer(resolvedEntry);
  if (!producer)
    throw new Error(
      "Producer loaded but exports not yet captured from " +
        JSON.stringify(resolvedEntry),
    );
  const create = mod.createRenderJob;
  const execute = mod.executeRenderJob;
  if (!create || !execute) {
    throw new Error(
      "@hyperframes/producer missing exports (create=" +
        !!create +
        ", execute=" +
        !!execute +
        ")",
    );
  }
  return { createRenderJob: create, executeRenderJob: execute };
}

module.exports = {
  getProducer,
  getRenderFunctions,
};
