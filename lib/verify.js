// Checks that every quote the model cites actually appears in the source text.
// A score is only as good as its evidence, so an unverifiable quote is flagged
// in the UI rather than shown as fact.

export function normalise(text) {
  return String(text)
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/[•·▪●]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// A quote may elide with "..." or "…". Each fragment must appear, in order.
export function quoteFound(quote, source) {
  const hay = normalise(source);
  const parts = normalise(quote)
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((p) => p.replace(/^["'\s]+|["'\s]+$/g, ""))
    .filter((p) => p.length > 0);
  if (parts.length === 0) return false;
  let from = 0;
  for (const part of parts) {
    const at = hay.indexOf(part, from);
    if (at === -1) return false;
    from = at + part.length;
  }
  return true;
}

export function checkQuotes(quotes, source) {
  return quotes.map((q) => ({ text: q, verified: quoteFound(q, source) }));
}
