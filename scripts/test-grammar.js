// Tokenizes sample Rein code with the TextMate grammar and checks the scopes. No network and no editor needed.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const onig = require("vscode-oniguruma");
const vsctm = require("vscode-textmate");

const grammarPath = path.resolve(__dirname, "..", "syntaxes", "rein.tmLanguage.json");

const wasm = fs.readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm"));
const wasmBuffer = wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength);

const registry = new vsctm.Registry({
  onigLib: onig.loadWASM(wasmBuffer).then(() => ({
    createOnigScanner: (patterns) => onig.createOnigScanner(patterns),
    createOnigString: (s) => onig.createOnigString(s),
  })),
  loadGrammar: async (scopeName) => {
    if (scopeName !== "source.rein") return null;
    const content = fs.readFileSync(grammarPath, "utf8");
    return vsctm.parseRawGrammar(content, grammarPath);
  },
});

// Returns one array of { text, scopes } per line.
async function tokenize(text) {
  const grammar = await registry.loadGrammar("source.rein");
  let ruleStack = vsctm.INITIAL;
  return text.split("\n").map((line) => {
    const result = grammar.tokenizeLine(line, ruleStack);
    ruleStack = result.ruleStack;
    return result.tokens.map((t) => ({ text: line.slice(t.startIndex, t.endIndex), scopes: t.scopes }));
  });
}

// Finds the first token whose trimmed text equals `text`. Throws if none exists.
function tokenFor(lines, text) {
  for (const line of lines) {
    for (const token of line) {
      if (token.text.trim() === text) return token;
    }
  }
  throw new Error(`no token with text ${JSON.stringify(text)}`);
}

function hasScope(token, scope) {
  return token.scopes.some((s) => s === scope || s.startsWith(`${scope}.`));
}

const sample1 = [
  "/** Decide. */",
  "export default async function f(",
  '  /** Which? */ c: "x" | "y",',
  ") {",
  '  if (c === "x") { return @./a/b; } else { return `Pick ${c}`; }',
  "}",
].join("\n");

const sample2 = 'const ok: boolean = await request("Do it.");';

const sample3 = [
  "export default function g(",
  "  /** Ask? */ flag: boolean,",
  ") {",
  '  return @./ci/fix(pr="it", note=`x ${flag}`);',
  "}",
].join("\n");

const checks = [];

// Each check: name and a function that receives the tokenized lines.
function check(name, fn) {
  checks.push({ name, fn });
}

check("reference @./a/b is entity.name.function", async () => {
  const lines = await tokenize(sample1);
  const token = tokenFor(lines, "@./a/b");
  assert.ok(hasScope(token, "entity.name.function"), JSON.stringify(token.scopes));
});

check("reference @./ci/fix is entity.name.function", async () => {
  const lines = await tokenize(sample3);
  const token = tokenFor(lines, "@./ci/fix");
  assert.ok(hasScope(token, "entity.name.function"), JSON.stringify(token.scopes));
});

check("if and return are keyword scopes", async () => {
  const lines = await tokenize(sample1);
  for (const word of ["if", "return"]) {
    const token = tokenFor(lines, word);
    assert.ok(hasScope(token, "keyword"), `${word}: ${JSON.stringify(token.scopes)}`);
  }
});

check("named argument name is a parameter scope", async () => {
  const lines = await tokenize(sample3);
  const token = tokenFor(lines, "pr");
  assert.ok(hasScope(token, "variable.parameter"), JSON.stringify(token.scopes));
});

check("await is a keyword scope", async () => {
  const lines = await tokenize(sample2);
  const token = tokenFor(lines, "await");
  assert.ok(hasScope(token, "keyword"), JSON.stringify(token.scopes));
});

check("double-quoted string is string.quoted", async () => {
  const lines = await tokenize(sample1);
  // The quote characters are separate captures, so the body text `x` carries the string scope.
  const token = tokenFor(lines, "x");
  assert.ok(hasScope(token, "string.quoted"), JSON.stringify(token.scopes));
});

check("template ${c} is meta.template.expression with variable.other inside", async () => {
  const lines = await tokenize(sample1);
  const inside = lines.flat().filter((t) => t.text === "c" && hasScope(t, "meta.template.expression"));
  assert.ok(inside.length >= 1, "no c token inside meta.template.expression");
  assert.ok(inside.some((t) => hasScope(t, "variable.other")), JSON.stringify(inside[0].scopes));
});

check("doc comment /** x */ is comment.block.documentation", async () => {
  const lines = await tokenize("/** x */\nconst a = 1;");
  const token = tokenFor(lines, "x");
  assert.ok(hasScope(token, "comment.block.documentation"), JSON.stringify(token.scopes));
});

check("=== is keyword.operator.comparison", async () => {
  const lines = await tokenize(sample1);
  const token = tokenFor(lines, "===");
  assert.ok(hasScope(token, "keyword.operator.comparison"), JSON.stringify(token.scopes));
});

check("request( is support.function, const is storage, boolean is storage.type", async () => {
  const lines = await tokenize(sample2);
  assert.ok(hasScope(tokenFor(lines, "request"), "support.function"));
  assert.ok(hasScope(tokenFor(lines, "const"), "storage"));
  assert.ok(hasScope(tokenFor(lines, "boolean"), "storage.type.rein"));
});

check("import is invalid.illegal", async () => {
  const lines = await tokenize('import x from "y";');
  assert.ok(hasScope(tokenFor(lines, "import"), "invalid.illegal"));
});

(async () => {
  let failed = 0;
  for (const { name, fn } of checks) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (err) {
      failed += 1;
      console.log(`not ok - ${name}`);
      console.log(`  ${String(err.message).split("\n").join("\n  ")}`);
    }
  }
  console.log(`${checks.length - failed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
