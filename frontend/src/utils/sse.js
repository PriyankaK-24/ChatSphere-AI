// Incremental parser for Server-Sent Events delivered over a fetch() stream.
// Feed it the accumulated buffer; it returns complete events plus the
// unfinished remainder to prepend to the next chunk.
export function parseSSE(buffer) {
  const events = [];
  const blocks = buffer.replace(/\r\n/g, "\n").split("\n\n");
  const rest = blocks.pop();
  for (const block of blocks) {
    let event = "message";
    const dataLines = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) continue;
    try {
      events.push({ event, data: JSON.parse(dataLines.join("\n")) });
    } catch {
      // Ignore a malformed event rather than breaking the whole stream.
    }
  }
  return { events, rest };
}
