<p align="center"><img src="https://github.com/rein-lang/assets/raw/main/logo-256.png" width="128" alt="Rein logo"></p>

# Rein for VS Code

Site: [rein-lang.com](https://rein-lang.com). Docs: [rein-lang.com/docs](https://rein-lang.com/docs/). Editor setup: [rein-lang.com/docs/editor](https://rein-lang.com/docs/editor).

Syntax highlighting, snippets, and language server support for `.rein` files.
Rein mimics TypeScript syntax and types, except `@` references (for example `@./ci/fix`). The grammar follows TypeScript's scope names.

Every language feature comes from the Rust language server, `rein lsp`, in the [rein repo](https://github.com/rein-lang/rein). The extension starts the server and passes requests to it. It holds no feature logic.

## Requirements

- VS Code 1.85 or later.
- The `rein` CLI on your `PATH`, or the full path to it in `rein.serverPath`. Install it from the [rein repo](https://github.com/rein-lang/rein):

  ```sh
  cargo install --git https://github.com/rein-lang/rein --tag v0.1.2 --locked rein
  ```

## Install

Install [Rein Language](https://marketplace.visualstudio.com/items?itemName=rein-lang.rein-language) from the Marketplace:

```sh
code --install-extension rein-lang.rein-language
```

To install a local build instead, package this repo and install the vsix:

```sh
pnpm install
pnpm run package
code --install-extension rein-language-0.3.1.vsix
```

If VS Code cannot find `rein`, set `rein.serverPath` to the full binary path.

## Imports

Import a function by name, as in TypeScript:

```ts
import { fix } from "./ci/fix";
```

The `@` references (for example `@./ci/fix`) are deprecated. The editor shows them struck through. The quick fix "Convert to named import" rewrites one. Rein 0.2.0 makes them an error, on or after 2026-12-19. To convert a whole program, run `rein migrate imports`.

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

## Development

1. Clone the [rein repo](https://github.com/rein-lang/rein) and build its CLI, for example `cargo build -p rein`.
2. Run `pnpm install` in this repo.
3. Open this repo in VS Code and press F5. Enter the path to the rein checkout when asked. The Extension Development Host opens that checkout.
4. In that window, the extension uses `target/debug/rein` or `target/release/rein` from the checkout when either exists. This lookup applies only to a `rein.serverPath` set to its default, `rein`. It assumes the Cargo layout of the rein repo.

## Test

`pnpm test` runs the `findServer` tests and the grammar tests. The grammar tests tokenize sample code with `vscode-textmate` and check the scopes. They need no editor and no network.

The language features have their tests in the rein repo: `cargo test -p rein --test lsp`.

## Commands

- `Rein: Restart Language Server` restarts the language server.
- `rein.showReferences` is internal. The reference code lens uses it to open the references view.

## Settings

- `rein.serverPath` (default `rein`): path to the rein binary. It starts as `<path> lsp`.
- `rein.trace.server` (`off`, `messages`, `verbose`): traces the messages between VS Code and the server.

## Release

Releases come from git; nobody publishes by hand.

1. Give each pull request a [Conventional Commits](https://www.conventionalcommits.org) title, such as `feat: ...` or `fix: ...`. The `PR title` check flags a bad title; do not merge while it is red. The repo allows squash merge only, so the title becomes the changelog line.
2. On each merge to `main`, release-please keeps a release pull request open. It bumps `package.json` and writes `CHANGELOG.md`.
3. Merge the release pull request. It tags the version, makes a GitHub release, and the publish workflow publishes the version to the Marketplace.

## License

MIT. See [LICENSE](LICENSE).
