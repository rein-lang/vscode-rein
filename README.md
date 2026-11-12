# Rein for VS Code

Syntax highlighting, snippets, and language server support for `.rein` files.
Rein mimics TypeScript syntax and types, except `@` references (for example `@./ci/fix`). The grammar follows TypeScript's scope names.

Every language feature comes from the Rust language server, `rein lsp`. The extension starts the server and passes requests to it. It holds no feature logic.

## Features

A program is one folder with a `main.rein`. A reference cannot leave its program, so references, call hierarchy and rename stay in one program.

| Feature | VS Code command | What it does |
| --- | --- | --- |
| Diagnostics | (live) | The checker's errors and warnings, on every change. |
| References | Find All References | On a function's name, on a `@./` reference, or anywhere else in a function's file: every reference to that function. On a parameter, or on `name=` in a call: its uses, and `name=` in every call to its function. |
| Reference count | Code lens | `N references` above each function, and above each shared struct. Click it to list them. |
| Go to definition | Go to Definition | A reference goes to its function. A parameter or `name=` goes to the parameter. A struct type goes to its `interface`. A field goes to its place in the `interface`. A std template, such as `delegate`, opens its source. |
| Call hierarchy | Show Call Hierarchy | Incoming: the functions that reference this one. Outgoing: the functions this one references. |
| Hover | (mouse) | On a function or reference: the doc comment and the parameters. On a parameter, field or `name=`: its type and question. On a struct: its doc and fields. On a std name: its doc. |
| Rename | Rename Symbol | A parameter: its uses and `name=` in every call. A field: its `interface`, its uses, and `name=` in every call. A function: its file, in the same folder, and every reference to it. A shared struct: its file and every type that names it. |
| Outline | Go to Symbol in Editor | The function, with its parameters and `const` answers. Each struct, with its fields. |
| Workspace symbols | Go to Symbol in Workspace | Every function of every program in the workspace, by its path, such as `billing/refund`. Each shared struct, by its path. |
| Completion | (typing) | After `@./`: the functions of the program. After `}: `: the shared structs. In call parentheses: the parameter names (or struct fields) not given yet, as `name=`. After `x === "` or `case "`: the union members. Elsewhere: parameters, std names, and keywords. |
| Signature help | (typing) | In call parentheses: the callee's parameters (or struct fields), with the current one marked. |
| Quick fixes | Quick Fix | Add a missing doc comment to a function or a parameter. Add `name=` to a positional argument. |

## Install

From the repo root, install the language server:

```sh
cargo install --path crates/rein
```

Then build and install the extension:

```sh
cd editors/vscode
pnpm install
pnpm run package
code --install-extension rein-0.1.0.vsix
```

If VS Code cannot find `rein`, set `rein.serverPath` to the full binary path.

## Develop

1. Open `editors/vscode` in VS Code.
2. Press F5. A new Extension Development Host window opens the repo root.
3. In that window, the extension uses `target/debug/rein` or `target/release/rein` when either exists.

## Test

`pnpm test` runs the `findServer` tests and the grammar tests. The grammar tests tokenize sample code with `vscode-textmate` and check the scopes.

The language features have their tests in the server: `cargo test -p rein --test lsp`. Each test drives `rein lsp` over JSON-RPC against a real example program.

## Commands

- `Rein: Restart Language Server` restarts the language server.
- `rein.showReferences` is internal. The reference code lens uses it to open the references view.

## Settings

- `rein.serverPath` (default `rein`): path to the rein binary. It starts as `<path> lsp`.
- `rein.trace.server` (`off`, `messages`, `verbose`): traces the messages between VS Code and the server.
