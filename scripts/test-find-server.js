// Tests findServer and the restart on a rein.serverPath change. It stubs `vscode`, so no editor is needed.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

const clients = [];
const listeners = [];
const vscodeStub = {
  workspace: {
    workspaceFolders: [],
    configured: "rein",
    getConfiguration: () => ({ get: (_key, fallback) => vscodeStub.workspace.configured ?? fallback }),
    createFileSystemWatcher: () => ({}),
    onDidChangeConfiguration: (fn) => {
      listeners.push(fn);
      return { dispose() {} };
    },
  },
  window: { showErrorMessage: () => {} },
  commands: { registerCommand: () => ({ dispose() {} }) },
};

class LanguageClientStub {
  constructor(_id, _name, server) {
    this.server = server;
    this.stopped = false;
    clients.push(this);
  }
  start() {
    return Promise.resolve();
  }
  stop() {
    this.stopped = true;
    return Promise.resolve();
  }
}

// extension.js loads `vscode` and the language client at require time. Both are stubbed here.
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "vscode") return vscodeStub;
  if (request === "vscode-languageclient/node") return { LanguageClient: LanguageClientStub };
  return originalLoad.call(this, request, ...rest);
};
const { findServer, activate } = require("../extension.js");
Module._load = originalLoad;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rein-find-server-"));
const home = path.join(tmp, "home");
const workspace = path.join(tmp, "workspace");

function executable(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "#!/bin/sh\n");
  fs.chmodSync(file, 0o755);
  return file;
}

const savedHome = process.env.HOME;
process.env.HOME = home;
vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: workspace } }];

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("absolute path to an executable is returned as it is", () => {
  const bin = executable(path.join(tmp, "abs", "rein-tool"));
  assert.strictEqual(findServer(bin), bin);
});

test("leading ~ expands to the home directory", () => {
  const bin = executable(path.join(home, "bin", "rein-tool"));
  assert.strictEqual(findServer("~/bin/rein-tool"), bin);
});

test("relative path resolves against the first workspace folder", () => {
  const bin = executable(path.join(workspace, "tools", "rein-tool"));
  assert.strictEqual(findServer("tools/rein-tool"), bin);
});

test("missing binary gives undefined", () => {
  assert.strictEqual(findServer(path.join(tmp, "nope", "rein")), undefined);
  assert.strictEqual(findServer("~/nope/rein"), undefined);
});

test("changing rein.serverPath restarts the client with the new binary", async () => {
  const first = executable(path.join(workspace, "bin", "first"));
  const second = executable(path.join(workspace, "bin", "second"));
  vscodeStub.workspace.configured = "bin/first";
  await activate({ subscriptions: [] });
  assert.strictEqual(clients.length, 1);
  assert.strictEqual(clients[0].server.command, first);

  await listeners[0]({ affectsConfiguration: (key) => key === "rein.trace.server" });
  assert.strictEqual(clients.length, 1, "other settings do not restart");

  vscodeStub.workspace.configured = "bin/second";
  await listeners[0]({ affectsConfiguration: (key) => key === "rein.serverPath" });
  assert.strictEqual(clients.length, 2);
  assert.strictEqual(clients[0].stopped, true);
  assert.strictEqual(clients[1].server.command, second);
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (err) {
      failed += 1;
      console.log(`not ok - ${name}`);
      console.log(`  ${String(err.message).split("\n").join("\n  ")}`);
    }
  }
  process.env.HOME = savedHome;
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`${tests.length - failed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
