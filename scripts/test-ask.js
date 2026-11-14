// Tests the mapping from a `rein/ask` event to a prompt, and the answer it collects. It needs no editor.
const assert = require("assert");
const { promptFor, collectAnswer } = require("../lib/ask.js");

assert.deepStrictEqual(promptFor({ kind: "question", key: "main.draft", type: "boolean", question: "Draft?" }), {
  kind: "pick",
  items: ["yes", "no"],
  title: "main.draft",
  placeHolder: "Draft?",
});

assert.deepStrictEqual(
  promptFor({ kind: "question", key: "main.task", type: "union", options: ["review", "merge"], question: "Task?" }),
  { kind: "pick", items: ["review", "merge"], title: "main.task", placeHolder: "Task?" }
);

assert.deepStrictEqual(promptFor({ kind: "input", key: "pr", name: "pr", type: "string", question: "The PR link." }), {
  kind: "input",
  title: "pr",
  prompt: "The PR link.",
});

assert.deepStrictEqual(
  promptFor({ kind: "request", key: "faq.solved", type: "boolean", instruction: "Send the article.", question: "Solved?" }),
  { kind: "pick", items: ["yes", "no"], title: "Send the article.", placeHolder: "Solved?" }
);

// A union with no options has nothing to pick, so it gets a text prompt.
assert.strictEqual(promptFor({ kind: "question", key: "x.y", type: "union", options: [] }).kind, "input");

async function run() {
  // Answers come back in the order the prompts are shown. The fake picks the first item, or types `text`.
  const answers = ["yes", "review"];
  const show = async (prompt) => answers.shift();

  const single = await collectAnswer({ kind: "question", key: "main.draft", type: "boolean" }, show);
  assert.strictEqual(single, "yes");

  const picked = [];
  const record = async (prompt) => {
    picked.push(prompt.title);
    return prompt.kind === "pick" ? prompt.items[0] : "typed";
  };
  const struct = await collectAnswer(
    {
      kind: "request",
      key: "faq.reply",
      type: "struct",
      instruction: "Reply to the customer.",
      fields: [
        { name: "solved", type: "boolean", description: "Solved?" },
        { name: "tone", type: "union", options: ["warm", "plain"], description: "Tone?" },
        { name: "note", type: "string", description: "Note?" },
      ],
    },
    record
  );
  assert.deepStrictEqual(struct, { solved: true, tone: "warm", note: "typed" });
  assert.deepStrictEqual(picked, ["Reply to the customer.", "Reply to the customer.", "Reply to the customer."]);

  const cancelled = await collectAnswer(
    { kind: "request", type: "struct", fields: [{ name: "a", type: "boolean" }] },
    async () => undefined
  );
  assert.strictEqual(cancelled, undefined);
}

run().then(() => console.log("ask tests passed"));
