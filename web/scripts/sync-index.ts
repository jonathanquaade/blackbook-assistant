import { syncIndex } from "../src/lib/live/sync";

syncIndex(process.argv.includes("--from-backup")).then(
  () => process.exit(0),
  () => process.exit(1),
);
