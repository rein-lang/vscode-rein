# Rein for VS Code

Syntax highlighting, snippets, and language server support for `.rein` files.
Rein is a strict subset of TypeScript, so the grammar is TypeScript's. The language server provides diagnostics, hover, go to definition, and completion for imports and parameters.

## Install

From the repo root, install the language server:

```sh
cargo install --path crates/rein
```

Then build and install the extension:

```sh
cd editors/vscode
npm install
npx vsce package
code --install-extension rein-0.1.0.vsix
```

If VS Code cannot find `rein`, set `rein.serverPath` to the full binary path.

## Develop

1. Open `editors/vscode` in VS Code.
2. Press F5. A new Extension Development Host window opens the repo root.
3. In that window, the extension uses `target/debug/rein` or `target/release/rein` when either exists.

## Check the syntax

`npm run check-ts-syntax` parses every `examples/**/*.rein` file with the TypeScript parser and fails on any syntax error.

## Commands

- `Rein: Restart Language Server` restarts the language server.

## Settings

- `rein.serverPath` (default `rein`): path to the rein binary. It starts as `<path> lsp`.
- `rein.trace.server` (`off`, `messages`, `verbose`): traces the messages between VS Code and the server.
