// Parses every examples/**/*.rein file as TypeScript and fails on any syntax error.
// Proves the claim that every Rein file is valid TypeScript syntax.
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const repo = path.resolve(__dirname, "..", "..", "..");
const examples = path.join(repo, "examples");

function reinFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return reinFiles(full);
    return entry.name.endsWith(".rein") ? [full] : [];
  });
}

const files = reinFiles(examples).sort();
let errors = 0;
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const d of sf.parseDiagnostics) {
    const { line, character } = sf.getLineAndCharacterOfPosition(d.start);
    const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    console.error(`${path.relative(repo, file)}:${line + 1}:${character + 1}: ${msg}`);
    errors += 1;
  }
}

if (files.length === 0) {
  console.error("no .rein files found under examples/");
  process.exit(1);
}
console.log(`${files.length} files, ${errors} syntax errors`);
process.exit(errors === 0 ? 0 : 1);
