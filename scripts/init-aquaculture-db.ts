import { loadEnvConfig } from "@next/env";
import {
  closeAquaculturePool,
  initializeAquacultureSchema,
} from "../lib/aquaculture/database";

loadEnvConfig(process.cwd());

async function main() {
  await initializeAquacultureSchema();
  console.log("Aquaculture database schema is ready.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeAquaculturePool();
  });
