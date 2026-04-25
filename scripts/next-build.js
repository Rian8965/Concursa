/* eslint-disable no-process-env */
process.env.NEXT_BUILD_WORKER_COUNT = process.env.NEXT_BUILD_WORKER_COUNT || "2";
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || "--max-old-space-size=4096";

// Next CLI expects to run as bin; load the internal entrypoint.
await import("next/dist/bin/next");

