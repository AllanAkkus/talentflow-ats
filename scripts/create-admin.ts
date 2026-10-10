import {
  adminClient,
  ensureUser,
  generatePassword,
  parseArgs,
} from "./_shared";
import { emailSchema, fullNameSchema, passwordSchema } from "../src/lib/validation/schemas";

/**
 * Create a platform admin account.
 *
 *   npm run create-admin -- --email you@example.com --name "Your Name"
 *   npm run create-admin -- --email you@example.com --name "Your Name" --password "Choose-One-1"
 *
 * With no --password a strong one is generated and printed once. Nothing is
 * written to the repository, so no credential is ever committed.
 *
 * This exists because there is no public signup: the very first admin cannot be
 * created from inside the product, only with the service-role key.
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));

  const email = emailSchema.safeParse(args.email ?? "");
  if (!email.success) {
    console.error(
      "\nUsage: npm run create-admin -- --email <email> --name <full name> [--password <password>]\n",
    );
    process.exit(1);
  }

  const fullName = fullNameSchema.safeParse(args.name ?? "");
  if (!fullName.success) {
    console.error("\n--name is required (at least 2 characters).\n");
    process.exit(1);
  }

  const generated = !args.password;
  const password = generated ? generatePassword() : args.password;

  const checkedPassword = passwordSchema.safeParse(password);
  if (!checkedPassword.success) {
    console.error(`\n${checkedPassword.error.issues[0].message}\n`);
    process.exit(1);
  }

  const supabase = adminClient();

  const { id, created } = await ensureUser(supabase, {
    email: email.data,
    password: checkedPassword.data,
    fullName: fullName.data,
    role: "admin",
    organizationId: null,
  });

  console.log("");
  console.log(created ? "Platform admin created." : "Account already existed - profile updated to platform admin.");
  console.log("-----------------------------------------------------------");
  console.log(`  Email    ${email.data}`);
  if (created || !generated) {
    console.log(`  Password ${checkedPassword.data}`);
  } else {
    console.log("  Password unchanged (the account already existed).");
  }
  console.log(`  User id  ${id}`);
  console.log(`  Role     admin (organization_id = NULL, global access)`);
  console.log("-----------------------------------------------------------");
  console.log("Store the password in a password manager. It is not saved anywhere else.");
  console.log("");
}

main().catch((error: unknown) => {
  console.error("\nFailed to create the admin account:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
