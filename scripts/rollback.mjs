import { configurePlugin } from "./configure-plugin.mjs";

const result = await configurePlugin("rollback");
process.stdout.write(
  `${JSON.stringify({ ...result, restartRequired: true }, null, 2)}\n`,
);
