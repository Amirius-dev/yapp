import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { repositoryRoot } from "../config.js";
import { createDatabase } from "./client.js";

const { db, sqlite } = createDatabase();
migrate(db, { migrationsFolder: join(repositoryRoot, "apps/api/drizzle") });
sqlite.close();

console.log("Database migrations applied.");
