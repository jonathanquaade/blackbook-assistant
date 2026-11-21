import { createShadowFixtures } from "../src/lib/shadow-fixtures";

const [dir, origin] = process.argv.slice(2);
if (!dir || !origin)
  throw new Error(
    "Usage: npx tsx scripts/shadow-fixture.ts ABSOLUTE_EMPTY_DIRECTORY HTTP_ORIGIN",
  );
createShadowFixtures(dir, origin).then(() => {
  console.log("Four fictional shadow-review cases created. No Notion request or real review-state write.");
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Fixture setup failed.");
  process.exitCode = 1;
});
