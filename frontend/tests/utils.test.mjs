import test from "node:test";
import assert from "node:assert/strict";
import { parseSSE } from "../src/utils/sse.js";
import { toSpeakableText, splitIntoChunks } from "../src/utils/speechText.js";

test("parseSSE parses complete events and keeps the remainder", () => {
  const buf =
    'event: meta\ndata: {"a":1}\n\n' +
    'event: token\ndata: {"text":"Hi"}\n\n' +
    'event: token\ndata: {"text":"par';
  const { events, rest } = parseSSE(buf);
  assert.deepEqual(events, [
    { event: "meta", data: { a: 1 } },
    { event: "token", data: { text: "Hi" } },
  ]);
  assert.equal(rest, 'event: token\ndata: {"text":"par');
});

test("parseSSE completes an event split across chunks", () => {
  let r = parseSSE('event: token\ndata: {"text":"a\\n');
  assert.equal(r.events.length, 0);
  r = parseSSE(r.rest + 'b"}\n\n');
  assert.deepEqual(r.events, [{ event: "token", data: { text: "a\nb" } }]);
  assert.equal(r.rest, "");
});

test("parseSSE handles CRLF and ignores malformed data", () => {
  const { events } = parseSSE('event: x\r\ndata: nope\r\n\r\nevent: y\r\ndata: {"ok":true}\r\n\r\n');
  assert.deepEqual(events, [{ event: "y", data: { ok: true } }]);
});

test("toSpeakableText strips markdown and omits code", () => {
  const md = "# Title\n\nSome **bold** and `inline` text with [a link](http://x.y).\n\n```js\nconst a = 1;\n```\n\n- item one\n1. item two";
  const out = toSpeakableText(md);
  assert.ok(!out.includes("```"));
  assert.ok(!out.includes("const a"));
  assert.ok(!out.includes("http"));
  assert.ok(out.includes("Title"));
  assert.ok(out.includes("bold"));
  assert.ok(out.includes("a link"));
  assert.ok(out.includes("code block omitted"));
});

test("splitIntoChunks keeps chunks bounded and loses no words", () => {
  const sentence = "This is a fairly ordinary sentence about nothing in particular. ";
  const text = sentence.repeat(30);
  const chunks = splitIntoChunks(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 440));
  assert.equal(chunks.join(" ").split(/\s+/).length, text.trim().split(/\s+/).length);
});

test("splitIntoChunks handles text without punctuation", () => {
  const text = "word ".repeat(300);
  const chunks = splitIntoChunks(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 440));
});
