/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({ override: true });

module.exports = {
  apps: [
    { name: "apms", script: "npm", args: "start", env: { PORT: 9107 } },
    { name: "apms-scheduler", script: "node_modules/.bin/tsx", args: "src/worker/scheduler.ts" },
  ],
};
