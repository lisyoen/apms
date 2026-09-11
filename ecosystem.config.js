/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config({ override: true });

module.exports = {
  apps: [
    { name: "dirigo", script: "npm", args: "start", env: { PORT: 9107 } },
    { name: "dirigo-scheduler", script: "node_modules/.bin/tsx", args: "src/worker/scheduler.ts" },
  ],
};
