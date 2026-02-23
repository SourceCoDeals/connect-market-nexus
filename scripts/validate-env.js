#!/usr/bin/env node

/**
 * Validate that the .env file contains every required environment variable.
 *
 * Usage:
 *   node scripts/validate-env.js
 *
 * Called automatically by `npm run setup`.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const REQUIRED_VARS = [
  {
    name: "VITE_SUPABASE_URL",
    description: "Supabase project URL (e.g. https://<ref>.supabase.co)",
  },
  {
    name: "VITE_SUPABASE_PUBLISHABLE_KEY",
    description: "Supabase anonymous / publishable API key",
  },
  {
    name: "VITE_SUPABASE_PROJECT_ID",
    description: "Supabase project reference ID",
  },
];

function parseEnvFile(filePath) {
  const vars = {};
  if (!existsSync(filePath)) {
    return vars;
  }

  const content = readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    vars[key] = value;
  }
  return vars;
}

// ---------------------------------------------------------------------------

const envPath = resolve(ROOT, ".env");
const envVars = parseEnvFile(envPath);

if (!existsSync(envPath)) {
  console.error("");
  console.error("  ERROR: No .env file found at the project root.");
  console.error("");
  console.error("  Create one by copying the example:");
  console.error("    cp .env.example .env");
  console.error("");
  console.error("  Then fill in the required values listed below:");
  REQUIRED_VARS.forEach((v) => {
    console.error(`    ${v.name} - ${v.description}`);
  });
  console.error("");
  process.exit(1);
}

const missing = [];
for (const v of REQUIRED_VARS) {
  const value = envVars[v.name];
  if (!value || value.trim() === "") {
    missing.push(v);
  }
}

if (missing.length > 0) {
  console.error("");
  console.error("  ERROR: The following required environment variables are missing or empty in .env:");
  console.error("");
  for (const v of missing) {
    console.error(`    - ${v.name}: ${v.description}`);
  }
  console.error("");
  console.error("  Please add them to your .env file and try again.");
  console.error("");
  process.exit(1);
}

console.log("  Environment validation passed. All required variables are set.");
