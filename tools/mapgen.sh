#!/usr/bin/env bash
# tools/mapgen.sh — генерирует .claude/map.md: карту строк index.html и
# deals.html (пронумерованные секции + все function-объявления с
# диапазонами строк), чтобы читать эти файлы через `sed -n START,ENDp`
# вместо целиком. Запускать после любой правки, сдвигающей нумерацию строк
# в этих двух файлах: bash tools/mapgen.sh
set -euo pipefail
cd "$(dirname "$0")/.."

python3 - <<'PYEOF'
import bisect
import os
import re

FILES = ['index.html', 'deals.html']
OUT_PATH = '.claude/map.md'

SECTION_RULE_RE = re.compile(r'^/\*\s*[-=]{5,}\s*$')
SECTION_TITLE_RE = re.compile(r'^\d+\.\s')
FUNC_RE = re.compile(r'^(async\s+)?function\s+([A-Za-z0-9_]+)\s*\(')

IDENT_CHAR_RE = re.compile(r'[A-Za-z0-9_$]')
IDENT_TAIL_RE = re.compile(r'[A-Za-z_$][A-Za-z0-9_$]*\Z')
REGEX_PRECEDER_CHARS = set('([{,;:=&|!?+-*%^~<>')
KEYWORDS_BEFORE_REGEX = {
    'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
    'throw', 'case', 'do', 'else', 'yield', 'await',
}

# ---------------------------------------------------------------------
# A small JS-ish tokenizer. Not a real parser — just enough to walk past
# strings, template literals (with arbitrarily nested `${...}` and nested
# backticks inside them), regex literals and comments without losing track
# of which '{'/'}' are real code braces. Needed because this codebase's
# render functions are giant template literals full of exactly that.
# ---------------------------------------------------------------------


def is_regex_start(text, slash_pos):
    """Tell a regex literal ("/.../ ") apart from a division operator at
    `text[slash_pos]` by looking at the previous significant token — the
    same rule real JS lexers use. Needed because e.g. `/"/`  contains a
    quote character that would otherwise look like the start of a string
    and swallow everything up to the next stray quote, real braces
    included."""
    j = slash_pos - 1
    while j >= 0 and text[j] in ' \t':
        j -= 1
    if j < 0 or text[j] == '\n':
        while j >= 0 and text[j] in ' \t\r\n':
            j -= 1
        if j < 0:
            return True
    ch = text[j]
    if ch in REGEX_PRECEDER_CHARS:
        return True
    if IDENT_CHAR_RE.match(ch):
        m = IDENT_TAIL_RE.search(text[:j + 1])
        word = m.group(0) if m else ''
        return word in KEYWORDS_BEFORE_REGEX
    if ch in ')]':
        return False
    return True


def skip_line_comment(text, i):
    j = text.find('\n', i)
    return len(text) if j == -1 else j


def skip_block_comment(text, i):
    j = text.find('*/', i + 2)
    return len(text) if j == -1 else j + 2


def skip_string(text, i):
    quote = text[i]
    n, j = len(text), i + 1
    while j < n and text[j] != '\n':
        if text[j] == '\\':
            j += 2
            continue
        if text[j] == quote:
            return j + 1
        j += 1
    return j


def skip_regex(text, i):
    n, j, in_class = len(text), i + 1, False
    while j < n and text[j] != '\n':
        if text[j] == '\\':
            j += 2
            continue
        if text[j] == '[':
            in_class = True
        elif text[j] == ']':
            in_class = False
        elif text[j] == '/' and not in_class:
            j += 1
            break
        j += 1
    while j < n and text[j].isalpha():
        j += 1
    return j


def find_template_end(text, start):
    """`start` = index of the opening backtick. Returns the index just
    past the matching closing backtick, recursing into any `${...}`
    interpolation (which may itself hold nested template literals,
    strings, regexes, comments and balanced braces)."""
    n = len(text)
    i = start + 1
    while i < n:
        c = text[i]
        if c == '\\':
            i += 2
            continue
        if c == '`':
            return i + 1
        if c == '$' and i + 1 < n and text[i + 1] == '{':
            i = find_interpolation_end(text, i + 2)
            continue
        i += 1
    return n


def find_interpolation_end(text, start):
    """`start` = index right after a template literal's '${'. Returns the
    index just past the matching '}', treating everything in between as
    ordinary code — so nested strings/templates/regexes/comments and
    balanced braces inside the expression don't confuse the caller."""
    n = len(text)
    depth, i = 1, start
    while i < n and depth > 0:
        c = text[i]
        if c == '/' and i + 1 < n and text[i + 1] == '/':
            i = skip_line_comment(text, i)
        elif c == '/' and i + 1 < n and text[i + 1] == '*':
            i = skip_block_comment(text, i)
        elif c in ('"', "'"):
            i = skip_string(text, i)
        elif c == '`':
            i = find_template_end(text, i)
        elif c == '/' and is_regex_start(text, i):
            i = skip_regex(text, i)
        elif c == '{':
            depth += 1
            i += 1
        elif c == '}':
            depth -= 1
            i += 1
        else:
            i += 1
    return i


def compute_skip_mask(text):
    """For every character in `text`, mark whether it sits inside a string,
    template literal, regex literal or comment — brace counting must
    ignore all of those."""
    n = len(text)
    skip = bytearray(n)
    i = 0
    while i < n:
        c = text[i]
        start = i
        if c == '/' and i + 1 < n and text[i + 1] == '/':
            i = skip_line_comment(text, i)
        elif c == '/' and i + 1 < n and text[i + 1] == '*':
            i = skip_block_comment(text, i)
        elif c in ('"', "'"):
            i = skip_string(text, i)
        elif c == '`':
            i = find_template_end(text, i)
        elif c == '/' and is_regex_start(text, i):
            i = skip_regex(text, i)
        else:
            i += 1
            continue
        for k in range(start, min(i, n)):
            skip[k] = 1
    return skip


def find_sections(lines):
    """Numbered section headers: a /* ---...--- */ or /* ===...=== */
    comment block whose first real content line reads "N. Title" (the
    convention documented in CLAUDE.md's Architecture section)."""
    sections = []
    i, n = 0, len(lines)
    while i < n:
        if SECTION_RULE_RE.match(lines[i].strip()):
            j = i + 1
            content = []
            while j < n and '*/' not in lines[j]:
                content.append(lines[j])
                j += 1
            title = None
            for cl in content:
                t = cl.strip().lstrip('*').strip()
                if t and not SECTION_RULE_RE.match('/* ' + t):
                    title = t
                    break
            if title and SECTION_TITLE_RE.match(title):
                sections.append((i + 1, title))  # 1-indexed start line
            i = j + 1
            continue
        i += 1
    return sections


def line_start_offsets(text):
    """Character offset where each (0-indexed) line begins, for mapping a
    char offset found while brace-counting back to a line number."""
    offsets = [0]
    for m in re.finditer('\n', text):
        offsets.append(m.end())
    return offsets


def offset_to_line(offsets, pos):
    return bisect.bisect_right(offsets, pos) - 1


def matching_brace_end_offset(text, skip, start_offset):
    """Char offset of the closing '}' matching the first (real, non-skip)
    '{' at or after `start_offset`."""
    depth = 0
    n = len(text)
    i = start_offset
    while i < n:
        if not skip[i]:
            if text[i] == '{':
                depth += 1
            elif text[i] == '}':
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    return n - 1


def find_functions(text, lines, skip, line_offsets):
    funcs = []
    for idx, line in enumerate(lines):
        m = FUNC_RE.match(line)
        if not m:
            continue
        start_offset = line_offsets[idx]
        end_offset = matching_brace_end_offset(text, skip, start_offset)
        end_line = offset_to_line(line_offsets, end_offset)
        funcs.append((idx + 1, end_line + 1, m.group(2)))
    return funcs


def render_file(fname):
    with open(fname, encoding='utf-8') as f:
        text = f.read()
    lines = text.split('\n')
    total = len(lines)
    out = [f'\n## {fname} ({total} строк)\n']

    sections = find_sections(lines)
    if sections:
        out.append('### Секции\n')
        for k, (ln, title) in enumerate(sections):
            end = (sections[k + 1][0] - 1) if k + 1 < len(sections) else total
            out.append(f'- L{ln}-{end}: {title}')
        out.append('')

    skip = compute_skip_mask(text)
    line_offsets = line_start_offsets(text)
    funcs = find_functions(text, lines, skip, line_offsets)
    if funcs:
        out.append('### Функции\n')
        for ln, end, name in funcs:
            out.append(f'- L{ln}-{end}: `{name}()`')
        out.append('')

    return '\n'.join(out)


def main():
    os.makedirs('.claude', exist_ok=True)
    parts = [
        '# Карта index.html и deals.html\n',
        'Сгенерировано `tools/mapgen.sh` — не редактировать руками. После '
        'любой правки, сдвигающей нумерацию строк в этих файлах, '
        'перегенерировать: `bash tools/mapgen.sh`.\n',
        'Использование: найти нужный диапазон здесь, прочитать его '
        '`sed -n \'START,ENDp\' файл`, а не файл целиком.\n',
    ]
    for fname in FILES:
        if os.path.exists(fname):
            parts.append(render_file(fname))
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        f.write('\n'.join(parts).rstrip() + '\n')
    print(f'Написано: {OUT_PATH}')


main()
PYEOF
