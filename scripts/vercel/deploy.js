import { spawn } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(__dirname, "../../server");

function run(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      stdio: "inherit",
      shell: true,
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
  });
}

async function main() {
  console.log("\nDeploying Vortex07 server API to Vercel...\n");
  const command = process.platform === "win32"
    ? "npx.cmd vercel deploy --prod --yes"
    : "npx vercel deploy --prod --yes";
  try {
    await run(command, serverDir);
    console.log("\n✅ Deploy finished. Run `npm run api:verify` to test endpoints.\n");
  } catch (err) {
    console.error("\n❌ Deploy failed:", err.message);
    console.error("Make sure you are logged in: npx vercel login\n");
    process.exit(1);
  }
}

main();
