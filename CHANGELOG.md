# Changelog

## [0.4.0](https://github.com/rein-lang/vscode-rein/compare/v0.3.3...v0.4.0) (2026-11-19)


### Features

* **grammar:** color @program/function references like local refs ([#3](https://github.com/rein-lang/vscode-rein/issues/3)) ([f80987c](https://github.com/rein-lang/vscode-rein/commit/f80987ce15f291a1748faa90d5c09bc74cedf82d))
* **grammar:** highlight import { } from ([#45](https://github.com/rein-lang/vscode-rein/issues/45)) ([b21ea02](https://github.com/rein-lang/vscode-rein/commit/b21ea027040f7f49c68039560c124354293fa61a))


### Bug Fixes

* install rein v0.1.1 ([#40](https://github.com/rein-lang/vscode-rein/issues/40)) ([510290c](https://github.com/rein-lang/vscode-rein/commit/510290c9de8e2ec15d5d48526c172a6faba5a69f))

## 0.3.3

- Point the install commands at rein v0.1.4.

## 0.3.2

- Point the install commands at rein v0.1.3.

## 0.3.1

- Point the install commands at rein v0.1.2, which adds named imports.

## 0.3.0

- Highlight named imports: `import { fix } from "./ci/fix";`, `import { fix as ciFix } from "./ci/fix";`.
- Highlight `import`, `from` and `as` as keywords, and the imported names as variables.
- The deprecated default import `import fix from "./ci/fix";` still highlights.

## [0.2.0](https://github.com/rein-lang/vscode-rein/compare/v0.1.1...v0.2.0) (2026-11-14)


### Features

* take the icon from the rein-lang/assets submodule ([#11](https://github.com/rein-lang/vscode-rein/issues/11)) ([43a3639](https://github.com/rein-lang/vscode-rein/commit/43a363993902d9f421ba6d221b78f0124cf5c735))

## 0.1.1

- Add Marketplace keywords, so search finds the extension.

## 0.1.0

- First Marketplace release, as `rein-lang.rein-language`.
- Syntax highlighting and snippets for `.rein` files.
- Starts the `rein lsp` language server: diagnostics, references, call hierarchy, rename.
- The Rein logo as the extension icon.
