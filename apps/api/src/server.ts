import { apiHost, apiPort } from "./config.js";
import { buildApp } from "./app.js";
import "./db/migrate.js";

const app = await buildApp();

try {
  await app.listen({ host: apiHost, port: apiPort });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
