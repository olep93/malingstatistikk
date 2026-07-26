/** Decode common HTML entities and remove malformed entity fragments from product names. */
export function decodeHtmlEntities(value: unknown): string {
  let text = String(value ?? "");
  text = text
    .replace(/&#x([0-9a-f]{1,6});?/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code >= 32 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d{1,7});?/g, (_, digits: string) => {
      const code = Number.parseInt(digits, 10);
      return Number.isFinite(code) && code >= 32 ? String.fromCodePoint(code) : "";
    })
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#[a-z0-9]+;?/gi, "")
    .replace(/&[a-z][a-z0-9]+;/gi, "")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/");
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function cleanProductName(value: unknown): string {
  return decodeHtmlEntities(value)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s*\|\s*(?:Obs BYGG|Coop).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
