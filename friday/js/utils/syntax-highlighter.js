/**
 * frAIday — Lightweight Syntax Highlighter & Diff Formatter
 */

export function highlightCode(code, lang = 'javascript') {
  if (!code) return '';
  
  // Escape HTML characters
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (lang === 'diff') {
    return formatDiff(escaped);
  }

  // Regex rules for keywords, strings, functions, numbers, comments
  if (lang === 'javascript' || lang === 'js' || lang === 'ts') {
    escaped = escaped
      // Comments
      .replace(/(\/\/[^\n]*)/g, '<span class="syn-comment">$1</span>')
      // Strings
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '<span class="syn-string">$1</span>')
      // Keywords
      .replace(/\b(async|await|const|let|var|function|return|if|else|for|while|import|export|from|default|class|extends|new|try|catch|throw|finally)\b/g, '<span class="syn-keyword">$1</span>')
      // Booleans & Null
      .replace(/\b(true|false|null|undefined)\b/g, '<span class="syn-type">$1</span>')
      // Numbers
      .replace(/\b(\d+)\b/g, '<span class="syn-number">$1</span>');
  } else if (lang === 'sql') {
    escaped = escaped
      // Comments
      .replace(/(--[^\n]*)/g, '<span class="syn-comment">$1</span>')
      // Strings
      .replace(/('(?:[^'\\]|\\.)*')/g, '<span class="syn-string">$1</span>')
      // SQL Keywords
      .replace(/\b(SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|CREATE|TABLE|DROP|ALTER|PRIMARY|KEY|FOREIGN|REFERENCES|JOIN|LEFT|RIGHT|INNER|ON|GROUP|BY|ORDER|ASC|DESC|LIMIT|OFFSET|INDEX|CASCADE|CONSTRAINT|DEFAULT|UUID|VARCHAR|INTEGER|BOOLEAN|JSONB|TIMESTAMP)\b/gi, '<span class="syn-keyword">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="syn-number">$1</span>');
  } else if (lang === 'json') {
    escaped = escaped
      .replace(/("(?:[^"\\]|\\.)*")\s*:/g, '<span class="syn-prop">$1</span>:')
      .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="syn-string">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="syn-type">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="syn-number">$1</span>');
  }

  return escaped;
}

export function formatDiff(diffText) {
  const lines = diffText.split('\n');
  return lines.map(line => {
    if (line.startsWith('+')) {
      return `<div class="diff-row insert"><span class="diff-gutter-sym">+</span><span>${line.substring(1)}</span></div>`;
    } else if (line.startsWith('-')) {
      return `<div class="diff-row delete"><span class="diff-gutter-sym">-</span><span>${line.substring(1)}</span></div>`;
    } else {
      return `<div class="diff-row"><span class="diff-gutter-sym">&nbsp;</span><span>${line}</span></div>`;
    }
  }).join('');
}
