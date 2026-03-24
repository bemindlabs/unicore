/**
 * Renders a subset of Markdown to ANSI escape sequences for xterm.js.
 * Supports: headings, bold, italic, inline code, code blocks, bullet/ordered lists.
 */

const R  = '\x1b[0m';   // reset
const B  = '\x1b[1m';   // bold
const DM = '\x1b[2m';   // dim
const UL = '\x1b[4m';   // underline
const CY = '\x1b[36m';  // cyan
const YL = '\x1b[33m';  // yellow
const WH = '\x1b[97m';  // bright white
const GR = '\x1b[90m';  // dark gray
const BG = '\x1b[48;5;236m'; // subtle dark background for code blocks

function inline(text: string): string {
  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, `${B}$1${R}`);
  text = text.replace(/__(.+?)__/g, `${B}$1${R}`);
  // Italic: *text* or _text_ (single)
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, `${DM}$1${R}`);
  text = text.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, `${DM}$1${R}`);
  // Inline code: `code`
  text = text.replace(/`([^`]+)`/g, `${CY}$1${R}`);
  return text;
}

export function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inCode = false;
  let codeLang = '';

  for (const raw of lines) {
    // Code fence
    if (raw.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeLang = raw.slice(3).trim();
        out.push(`${GR}${BG} ${codeLang ? `[${codeLang}]` : 'code'} ${R}`);
      } else {
        inCode = false;
        codeLang = '';
        out.push(`${GR}───${R}`);
      }
      continue;
    }

    if (inCode) {
      out.push(`${BG}  ${CY}${raw}${R}`);
      continue;
    }

    // ATX headings
    if (raw.startsWith('### ')) {
      out.push(`${B}${YL}${raw.slice(4)}${R}`);
      continue;
    }
    if (raw.startsWith('## ')) {
      out.push(`${B}${YL}${UL}${raw.slice(3)}${R}`);
      continue;
    }
    if (raw.startsWith('# ')) {
      out.push(`${B}${WH}${UL}${raw.slice(2)}${R}`);
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(raw.trim())) {
      out.push(`${GR}──────────────────────────────────${R}`);
      continue;
    }

    // Unordered list
    const ulMatch = raw.match(/^(\s*)[-*+] (.*)$/);
    if (ulMatch) {
      const indent = ulMatch[1] ?? '';
      out.push(`${indent}  ${CY}•${R} ${inline(ulMatch[2] ?? '')}`);
      continue;
    }

    // Ordered list
    const olMatch = raw.match(/^(\s*)(\d+)\. (.*)$/);
    if (olMatch) {
      const indent = olMatch[1] ?? '';
      out.push(`${indent}  ${CY}${olMatch[2]}.${R} ${inline(olMatch[3] ?? '')}`);
      continue;
    }

    // Blockquote
    if (raw.startsWith('> ')) {
      out.push(`${GR}│${R} ${DM}${inline(raw.slice(2))}${R}`);
      continue;
    }

    out.push(inline(raw));
  }

  return out.join('\r\n');
}
