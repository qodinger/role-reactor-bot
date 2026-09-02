#!/usr/bin/env python3
"""Unwrap { embeds: [helper(...)], flags: Ephemeral } -> helper(...).

Handles exactly-one-element embeds arrays (with optional trailing comma and
optional sibling `flags: MessageFlags.Ephemeral|64`). Anything more exotic is
reported for manual fixing. Dry-run by default; pass --apply to write.
"""
import re, os, sys

HELPERS = r"(?:errorEmbed|infoEmbed|permissionErrorEmbed|processingEmbed|validationErrorEmbed|successEmbed)"
APPLY = "--apply" in sys.argv
SKIP_FILES = {
    "src/server/webhookServer.js",
    "src/server/middleware/errorHandler.js",
    "src/server/routes/v1/stats.js",
}

def match_close(s, i):
    """s[i] is an opener; return index of matching closer (string-aware)."""
    pairs = {"(": ")", "{": "}", "[": "]"}
    stack = []
    in_str, esc = None, False
    while i < len(s):
        c = s[i]
        if in_str:
            if esc: esc = False
            elif c == "\\": esc = True
            elif c == in_str: in_str = None
        else:
            if c in "\"'`": in_str = c
            elif c in pairs: stack.append(pairs[c])
            elif c in ")]}":
                if not stack or stack.pop() != c: return -1
                if not stack: return i
        i += 1
    return -1

OBJ_RE = re.compile(
    r"\{\s*embeds\s*:\s*\[\s*(" + HELPERS + r")\s*\("
)

def process(path):
    s = open(path).read()
    if "embeds" not in s: return 0, []
    sites, manual, pos = [], [], 0
    while True:
        m = OBJ_RE.search(s, pos)
        if not m: break
        obj_open = m.start()
        call_open = m.end() - 1                      # the '(' of the helper
        call_end = match_close(s, call_open)
        if call_end == -1:
            manual.append((pos, "unbalanced helper parens")); pos = m.end(); continue
        # single-element array: optional ws, optional ',', ws, ']'
        ma = re.match(r"\s*,?\s*\]", s[call_end+1:])
        if not ma:
            manual.append((obj_open, "array not single-element")); pos = m.end(); continue
        after = call_end + 1 + ma.end()
        # optional sibling flags then object close (allow trailing comma)
        mo = re.match(
            r"\s*(?:,\s*flags\s*:\s*(?:MessageFlags\.Ephemeral|64)\s*)?,?\s*\}",
            s[after:],
        )
        if not mo:
            manual.append((obj_open, "object has extra keys")); pos = m.end(); continue
        obj_close = after + mo.end() - 1
        call_text = s[m.start(1):call_end+1]
        sites.append((obj_open, obj_close, call_text))
        pos = obj_close
    # apply right-to-left so indices stay valid
    out = s
    for obj_open, obj_close, call_text in sorted(sites, reverse=True):
        out = out[:obj_open] + " " + call_text + " " + out[obj_close+1:]
    if sites and APPLY:
        open(path, "w").write(out)
    return len(sites), [(o, why) for o, why in manual]

total = 0
manuals = []
for root, _dirs, files in os.walk("src"):
    for fn in sorted(files):
        if not fn.endswith(".js"): continue
        p = os.path.join(root, fn)
        if p in SKIP_FILES: continue
        n, man = process(p)
        total += n
        if man: manuals.append((p, man))
        if n: print(f"{p}: {n} unwrapped")

print(f"\nTOTAL: {total} {'applied' if APPLY else 'dry-run'}")
for p, man in manuals:
    for off, why in man:
        line = open(p).read()[:off].count("\n") + 1
        print(f"MANUAL  {p}:{line}  ({why})")
