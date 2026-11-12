// Turns Markdown into text that sounds natural when read aloud.
export function toSpeakableText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " (code block omitted) ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Browsers can cut off long utterances, so speak in sentence-sized chunks.
export function splitIntoChunks(text, max = 220) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [];
  const chunks = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && (current + sentence).length > max) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
    while (current.length > max * 2) {
      const cut = current.lastIndexOf(" ", max) > 0 ? current.lastIndexOf(" ", max) : max;
      chunks.push(current.slice(0, cut).trim());
      current = current.slice(cut);
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
