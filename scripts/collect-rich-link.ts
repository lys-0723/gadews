import { loadEnvConfig } from "@next/env";
import { collectConfiguredDevices } from "../lib/aquaculture/collector";
import { getRichLinkSettings } from "../lib/aquaculture/config";
import { closeAquaculturePool } from "../lib/aquaculture/database";

loadEnvConfig(process.cwd());

interface CliOptions {
  watch: boolean;
  deviceKey?: string;
  startDate?: string;
  endDate?: string;
}

function parseArguments(args: string[]): CliOptions {
  const options: CliOptions = { watch: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--watch") {
      options.watch = true;
    } else if (argument === "--device") {
      options.deviceKey = args[++index];
    } else if (argument === "--start") {
      options.startDate = args[++index];
    } else if (argument === "--end") {
      options.endDate = args[++index];
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runOnce(options: CliOptions) {
  const results = await collectConfiguredDevices({
    deviceKey: options.deviceKey,
    startDate: options.startDate,
    endDate: options.endDate,
  });
  console.log(
    JSON.stringify(
      { collectedAt: new Date().toISOString(), devices: results },
      null,
      2
    )
  );
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options.watch) {
    await runOnce(options);
    return;
  }

  const settings = getRichLinkSettings();
  const intervalMs = settings.pollIntervalSeconds * 1_000;
  console.log(`Rich-Link collector started; interval=${settings.pollIntervalSeconds}s`);

  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  while (!stopping) {
    try {
      await runOnce(options);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
    if (!stopping) await delay(intervalMs);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeAquaculturePool();
  });
