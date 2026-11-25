// Maps the `rein/ask` event of `rein dap` to the prompt that asks the user. No `vscode` here, so plain node tests run it.
//
// An ask body is one of: a question (`kind: "question"`), a request (`kind: "request"`, with its `instruction`), or
// a `string` input (`kind: "input"`). A struct answer (`type: "struct"`) has `fields`, and each field is asked in turn.

/// One prompt for `item`: `{kind: "pick", items, title, placeHolder}` or `{kind: "input", title, prompt}`.
function promptFor(item) {
  const title = item.kind === "request" ? item.instruction : item.key || item.name;
  const question = item.question || item.description || item.name || item.key;
  const items = item.type === "boolean" ? ["yes", "no"] : item.options || [];
  if (item.kind === "input" || item.type === "string" || items.length === 0) {
    return { kind: "input", title, prompt: question };
  }
  return { kind: "pick", items, title, placeHolder: question };
}

/// Asks for the whole answer. `show(prompt)` resolves to the picked or typed text, or `undefined` when cancelled.
/// A struct answer is an object: a boolean field gives `true` or `false`, every other field its text.
async function collectAnswer(body, show) {
  if (body.type !== "struct") return show(promptFor(body));
  const answer = {};
  for (const field of body.fields || []) {
    const item = { ...field, kind: body.kind, instruction: body.instruction, key: body.key };
    const raw = await show(promptFor(item));
    if (raw === undefined) return undefined;
    answer[field.name] = field.type === "boolean" ? raw === "yes" : raw;
  }
  return answer;
}

module.exports = { promptFor, collectAnswer };
