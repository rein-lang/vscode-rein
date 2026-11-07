const fs = require("fs");
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
  if (path.isAbsolute(configured) || configured.includes(path.sep)) {
    return isExecutable(configured) ? configured : undefined;
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
          vscode.workspace.createFileSystemWatcher("**/rein.toml"),
        ],
      },
    }
  );
  await client.start();
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("rein.restartServer", () => startServer())
  );
  return startServer();
}

function deactivate() {
  return stopServer();
}

module.exports = { activate, deactivate };
