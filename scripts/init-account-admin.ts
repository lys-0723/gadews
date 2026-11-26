import { accountDb } from "../lib/accounts/storage";
import { bootstrap } from "../lib/accounts/service";
async function main() {
  const db = await accountDb();
  try {
    await bootstrap(db, {
      username: process.env.GADEWS_ADMIN_USERNAME,
      password: process.env.GADEWS_ADMIN_PASSWORD,
    });
    console.log("System administrator created.");
  } finally {
    db.close();
  }
}
main().catch(() => {
  console.error(
    "Could not create the administrator. Check credentials, storage settings and whether an administrator already exists.",
  );
  process.exitCode = 1;
});
