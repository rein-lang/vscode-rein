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

// Returns one array of { text, scopes, start, end } per line. start and end are offsets in the line.
async function tokenize(text) {
  const grammar = await registry.loadGrammar("source.rein");
  let ruleStack = vsctm.INITIAL;
  return text.split("\n").map((line) => {
    const result = grammar.tokenizeLine(line, ruleStack);
    ruleStack = result.ruleStack;
    return result.tokens.map((t) => ({
      text: line.slice(t.startIndex, t.endIndex),
      scopes: t.scopes,
      start: t.startIndex,
      end: t.endIndex,
    }));
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

// Returns the token that covers character `index` of one tokenized line.
// The grammar merges neighbouring tokens with the same scopes, so a plain identifier
// such as the member in `obj.Date` may not have a token whose text is exactly "Date".
function tokenAt(line, index) {
  const token = line.find((t) => t.start <= index && index < t.end);
  if (!token) throw new Error(`no token at index ${index}`);
  return token;
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

check("@./x, @../y, @pr-handling and @pr-handling/main are the same reference scope", async () => {
  const lines = await tokenize(
    ["  return @./x;", "  return @../y;", "  return @pr-handling;", "  return @pr-handling/main(pr=pr);"].join("\n"),
  );
  for (const ref of ["@./x", "@../y", "@pr-handling", "@pr-handling/main"]) {
    const token = tokenFor(lines, ref);
    assert.ok(hasScope(token, "entity.name.function.rein"), `${ref}: ${JSON.stringify(token.scopes)}`);
  }
  assert.ok(hasScope(tokenFor(lines, "pr"), "variable.parameter"));
});

check("@ inside a text template is not a reference", async () => {
  const lines = await tokenize("  return `Hand it to @pr-handling/main now.`;");
  const refs = lines.flat().filter((t) => hasScope(t, "entity.name.function"));
  assert.deepStrictEqual(refs, []);
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

check("== and != are keyword.operator.comparison", async () => {
  const lines = await tokenize('if (c == "x") { return "a"; }\nif (c != "x") { return "b"; }');
  for (const op of ["==", "!="]) {
    const token = tokenFor(lines, op);
    assert.ok(hasScope(token, "keyword.operator.comparison"), JSON.stringify(token.scopes));
  }
});

check("request( is support.function, const is storage, boolean is storage.type", async () => {
  const lines = await tokenize(sample2);
  assert.ok(hasScope(tokenFor(lines, "request"), "support.function"));
  assert.ok(hasScope(tokenFor(lines, "const"), "storage"));
  assert.ok(hasScope(tokenFor(lines, "boolean"), "storage.type.rein"));
});

// Import fixture: the five import forms from the Rein roadmap ("The new syntax").
const importFixture = [
  'import { fix } from "./ci/fix";',
  'import { fix as ciFix } from "./ci/fix";',
  'import { Message } from "./message.struct";',
  'import { prHandling } from "pr-handling";',
  'import fix from "./ci/fix";',
].join("\n");

check("import, from and as are keyword.control.import", async () => {
  const lines = await tokenize(importFixture);
  for (const word of ["import", "from"]) {
    const token = tokenFor(lines, word);
    assert.ok(hasScope(token, "keyword.control.import"), `${word}: ${JSON.stringify(token.scopes)}`);
  }
  const asToken = tokenFor(lines, "as");
  assert.ok(hasScope(asToken, "keyword.control.import"), `as: ${JSON.stringify(asToken.scopes)}`);
});

check("import braces are punctuation", async () => {
  const lines = await tokenize(importFixture);
  for (const brace of lines[0].filter((t) => t.text === "{" || t.text === "}")) {
    assert.ok(hasScope(brace, "punctuation.definition.block"), JSON.stringify(brace.scopes));
  }
  assert.ok(lines[0].some((t) => t.text === "{"), "no { token on line 1");
});

check("imported names and aliases are variable.other", async () => {
  const lines = await tokenize(importFixture);
  assert.ok(hasScope(tokenFor(lines, "fix"), "variable.other"), JSON.stringify(tokenFor(lines, "fix").scopes));
  assert.ok(hasScope(tokenFor(lines, "ciFix"), "variable.other"), JSON.stringify(tokenFor(lines, "ciFix").scopes));
  assert.ok(hasScope(tokenFor(lines, "Message"), "variable.other"), JSON.stringify(tokenFor(lines, "Message").scopes));
  assert.ok(hasScope(tokenFor(lines, "prHandling"), "variable.other"), JSON.stringify(tokenFor(lines, "prHandling").scopes));
});

check("import paths are string.quoted.double", async () => {
  const lines = await tokenize(importFixture);
  for (const path of ["./ci/fix", "./message.struct", "pr-handling"]) {
    const token = tokenFor(lines, path);
    assert.ok(hasScope(token, "string.quoted.double"), `${path}: ${JSON.stringify(token.scopes)}`);
  }
});

check("import statement ends at ; and the next line is not import scope", async () => {
  const lines = await tokenize(['import { fix } from "./ci/fix";', "const ok = 1;"].join("\n"));
  const constToken = tokenFor(lines, "const");
  assert.ok(hasScope(constToken, "storage"), JSON.stringify(constToken.scopes));
  assert.ok(!hasScope(constToken, "meta.import"), JSON.stringify(constToken.scopes));
});

check("@./path reference still is entity.name.function outside import", async () => {
  const lines = await tokenize(["import { fix } from \"./ci/fix\";", "  return @./ci/fix(pr=\"x\");"].join("\n"));
  assert.ok(hasScope(tokenFor(lines, "@./ci/fix"), "entity.name.function"));
});

check("format type names are storage.type.rein, like string", async () => {
  const lines = await tokenize(
    ["/** Link. */", "export default function h(", "  /** Where? */ link: IRI,", "  /** When? */ at: DateTime,", ") {", "  return `${link}`;", "}"].join("\n"),
  );
  for (const name of ["IRI", "DateTime"]) {
    const token = tokenFor(lines, name);
    assert.ok(hasScope(token, "storage.type.rein"), `${name}: ${JSON.stringify(token.scopes)}`);
  }
});

// The 19 built-in format names, copied from Format::spec in crates/rein-core/src/formats.rs (rein repo).
// Copied, not read at test time: CI does not check out the rein repo.
const formatNames = [
  "IRI", "IRIReference", "URI", "URIReference", "URITemplate",
  "Email", "IdnEmail", "Hostname", "IdnHostname", "IPv4", "IPv6",
  "Date", "Time", "DateTime", "Duration", "UUID",
  "JSONPointer", "RelativeJSONPointer", "Regex",
];

check("all 19 format names are typed with the same scope as string", async () => {
  assert.strictEqual(formatNames.length, 19);
  const stringToken = tokenFor(await tokenize("const v: string = 1;"), "string");
  for (const name of formatNames) {
    const token = tokenFor(await tokenize(`const v: ${name} = 1;`), name);
    assert.deepStrictEqual(token.scopes, stringToken.scopes, `${name}: ${JSON.stringify(token.scopes)}`);
  }
});

check("format type name in a string or template is not a type", async () => {
  const lines = await tokenize('const s = "Date"; const t = `Email`;');
  for (const name of ["Date", "Email"]) {
    const token = tokenFor(lines, name);
    assert.ok(!hasScope(token, "storage.type.rein"), `${name}: ${JSON.stringify(token.scopes)}`);
  }
});

check("format type name inside a longer identifier is not a type", async () => {
  const lines = await tokenize("const UUIDs = 1; const Dates = 2; const IRIish = 3; const myDate = 4;");
  for (const name of ["UUIDs", "Dates", "IRIish", "myDate"]) {
    const token = tokenFor(lines, name);
    assert.ok(!hasScope(token, "storage.type.rein"), `${name}: ${JSON.stringify(token.scopes)}`);
  }
});

check("format type name after a dot or hyphen is not a type, with or without spaces, but after a colon it is", async () => {
  const sourceLines = ["const a = obj.Date;", "const b = obj . Date;", "const c = pr-Date;", "const d: Date = 1;"];
  const lines = await tokenize(sourceLines.join("\n"));
  // Untyped member names have no token of their own text (the grammar merges them), so find the token by offset.
  for (let i = 0; i < 3; i++) {
    const index = sourceLines[i].indexOf("Date");
    const token = tokenAt(lines[i], index);
    assert.ok(token.start <= index && index < token.end);
    assert.ok(!hasScope(token, "storage.type.rein"), `line ${i + 1}: ${JSON.stringify(token.scopes)}`);
  }
  const typed = tokenFor([lines[3]], "Date");
  assert.ok(hasScope(typed, "storage.type.rein"), `: Date: ${JSON.stringify(typed.scopes)}`);
});

check("format names in value and key positions are not types", async () => {
  const cases = ["f(Date);", "const o = { Date: 1 };", "const n = Date.now();", "return Date;"];
  for (const source of cases) {
    const line = (await tokenize(source))[0];
    const token = tokenAt(line, source.indexOf("Date"));
    assert.ok(!hasScope(token, "storage.type.rein"), `${source}: ${JSON.stringify(token.scopes)}`);
  }
});

check("format names after | and < are types", async () => {
  const lines = await tokenize("function g(a: string | Date) {}\nconst m: List<Date> = 1;");
  assert.ok(hasScope(tokenFor(lines, "Date"), "storage.type.rein"));
  assert.ok(hasScope(tokenFor([lines[1]], "Date"), "storage.type.rein"));
});

// Pinned behavior: boolean and string after a dot or hyphen are member or identifier names, not types.
check("boolean and string after a dot or hyphen are not types", async () => {
  const sourceLines = ["const a = obj.string;", "const b = obj . boolean;", "const c = pr-string;"];
  const lines = await tokenize(sourceLines.join("\n"));
  for (let i = 0; i < sourceLines.length; i++) {
    const word = sourceLines[i].includes("boolean") ? "boolean" : "string";
    const index = sourceLines[i].indexOf(word);
    const token = tokenAt(lines[i], index);
    assert.ok(!hasScope(token, "storage.type.rein"), `${sourceLines[i]}: ${JSON.stringify(token.scopes)}`);
  }
});

check("import of a format-named binding from a .schema file is variable.other, not a type", async () => {
  const lines = await tokenize('import { Date, Ticket } from "./ticket.schema";');
  for (const name of ["Date", "Ticket"]) {
    const token = tokenFor(lines, name);
    assert.ok(hasScope(token, "variable.other"), `${name}: ${JSON.stringify(token.scopes)}`);
    assert.ok(!hasScope(token, "storage.type.rein"), `${name}: ${JSON.stringify(token.scopes)}`);
  }
  assert.ok(hasScope(tokenFor(lines, "./ticket.schema"), "string.quoted.double"));
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
