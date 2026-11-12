const fs = require("fs");
const os = require("os");
const path = require("path");
const vscode = require("vscode");
const { LanguageClient } = require("vscode-languageclient/node");
const { collectAnswer } = require("./lib/ask.js");

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
      `Rein: binary "${configured}" not found. Install it with \`cargo install --git https://github.com/tupe12334/rein rein\`, or set rein.serverPath.`
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

// Debugging. `rein dap` walks the program. A question it cannot answer comes back as a `rein/ask` event, and the
// answer goes back as a `rein/answer` request.
function debugProgram(noDebug) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "rein") {
    vscode.window.showWarningMessage("Rein: open a .rein file to run it.");
    return undefined;
  }
  const config = {
    type: "rein",
    request: "launch",
    name: noDebug ? "Run Rein Program" : "Debug Rein Program",
    program: editor.document.uri.fsPath,
  };
  const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  return vscode.debug.startDebugging(folder, config, { noDebug });
}

// Starts the same binary as `rein lsp`, with `dap`.
class ReinDebugAdapterFactory {
  createDebugAdapterDescriptor() {
    const configured = vscode.workspace.getConfiguration("rein").get("serverPath", "rein");
    const command = findServer(configured);
    if (!command) {
      vscode.window.showErrorMessage(`Rein: binary "${configured}" not found. Set rein.serverPath.`);
      return undefined;
    }
    return new vscode.DebugAdapterExecutable(command, ["dap"]);
  }
}

// A debug session with no launch.json (F5 on a .rein file) runs the open program.
const debugConfigurations = {
  resolveDebugConfiguration(_folder, config) {
    if (config.program) return config;
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "rein") {
      vscode.window.showErrorMessage("Rein: open a .rein file to debug it.");
      return undefined;
    }
    return { ...config, type: "rein", request: "launch", name: "Debug Rein Program", program: editor.document.uri.fsPath };
  },
};

function showPrompt(prompt) {
  if (prompt.kind === "pick") {
    return vscode.window.showQuickPick(prompt.items, { title: prompt.title, placeHolder: prompt.placeHolder, ignoreFocusOut: true });
  }
  return vscode.window.showInputBox({ title: prompt.title, prompt: prompt.prompt, ignoreFocusOut: true });
}

async function answerAsk(event) {
  if (event.event !== "rein/ask") return;
  const value = await collectAnswer(event.body, showPrompt);
  // Cancelled prompt: stop the program rather than leave it waiting.
  if (value === undefined) return vscode.debug.stopDebugging(event.session);
  return event.session.customRequest("rein/answer", { key: event.body.key, value });
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("rein.debugProgram", () => debugProgram(false)),
    vscode.commands.registerCommand("rein.runProgram", () => debugProgram(true)),
    vscode.debug.registerDebugAdapterDescriptorFactory("rein", new ReinDebugAdapterFactory()),
    vscode.debug.registerDebugConfigurationProvider("rein", debugConfigurations),
    vscode.debug.onDidReceiveDebugSessionCustomEvent(answerAsk),
    vscode.commands.registerCommand("rein.restartServer", () => startServer()),
    // The server's reference code lens sends LSP JSON. VS Code's references view takes its own types.
    vscode.commands.registerCommand("rein.showReferences", (uri, position, locations) => {
      if (!client) return;
      const p2c = client.protocol2CodeConverter;
      return vscode.commands.executeCommand(
        "editor.action.showReferences",
        p2c.asUri(uri),
        p2c.asPosition(position),
        locations.map((l) => p2c.asLocation(l))
      );
    }),
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
