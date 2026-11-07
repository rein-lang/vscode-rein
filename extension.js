const fs = require("fs");
const os = require("os");
const path = require("path");
const vscode = require("vscode");
const { LanguageClient } = require("vscode-languageclient/node");

let client;

function isExecutable(file) {
  try {
    fs.accessSync(file, fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

// A leading `~` means the home directory.
function expandHome(configured) {
  return configured === "~" || configured.startsWith("~/") ? path.join(os.homedir(), configured.slice(1)) : configured;
}

// Returns the full path of the server binary, or undefined when it is missing.
function findServer(configured) {
  if (configured === "rein") {
    // Works inside the rein repo without an install.
    for (const folder of vscode.workspace.workspaceFolders || []) {
      for (const profile of ["debug", "release"]) {
        const built = path.join(folder.uri.fsPath, "target", profile, "rein");
        if (isExecutable(built)) return built;
      }
    }
  }
  const expanded = expandHome(configured);
  if (path.isAbsolute(expanded)) {
    return isExecutable(expanded) ? expanded : undefined;
  }
  if (expanded.includes(path.sep)) {
    // A relative path is relative to the first workspace folder.
    const folder = (vscode.workspace.workspaceFolders || [])[0];
    const full = path.resolve(folder ? folder.uri.fsPath : ".", expanded);
    return isExecutable(full) ? full : undefined;
  }
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    const candidate = path.join(dir, configured);
    if (isExecutable(candidate)) return candidate;
  }
  return undefined;
}

async function stopServer() {
  if (client) {
    const old = client;
    client = undefined;
    await old.stop();
  }
}

async function startServer() {
  await stopServer();
  const configured = vscode.workspace.getConfiguration("rein").get("serverPath", "rein");
  const command = findServer(configured);
  if (!command) {
    vscode.window.showErrorMessage(
      `Rein: binary "${configured}" not found. Install it with \`cargo install --path crates/rein\` from the repo root, or set rein.serverPath.`
    );
    return;
  }
  client = new LanguageClient(
    "rein",
    "Rein Language Server",
    { command, args: ["lsp"] },
    {
      documentSelector: [{ scheme: "file", language: "rein" }],
      synchronize: {
        fileEvents: [
          vscode.workspace.createFileSystemWatcher("**/*.rein"),
          vscode.workspace.createFileSystemWatcher("**/main.rein"),
        ],
      },
    }
  );
  await client.start();
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("rein.restartServer", () => startServer()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("rein.serverPath")) return startServer();
    })
  );
  return startServer();
}

function deactivate() {
  return stopServer();
}

module.exports = { activate, deactivate, findServer };
