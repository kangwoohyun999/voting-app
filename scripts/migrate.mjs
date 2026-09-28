// Applies lib/polls/schema.sql to the database in DATABASE_URL.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(new URL("../lib/polls/schema.sql", import.meta.url), "utf8");

// Neon's HTTP driver runs one statement per query.
const statements = schema
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) await sql.query(statement);
console.log(`Applied ${statements.length} statements.`);
