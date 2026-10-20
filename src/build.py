#!/usr/bin/env python3
"""Assemble index.html and the bundled assets.

    python3 src/build.py                 # writes ./index.html + assets/dist/site.{css,js}
    python3 src/build.py --out some.html # writes the page elsewhere (used for previews)

Edit the source files, never assets/dist/ (it is regenerated on every build):
    src/index.template.html   page shell (header, menu, footer, flag hunt)
    src/partials/NAME.html    one file per section
    assets/css/main.css + assets/css/sections/NAME.css   -> assets/dist/site.css
    assets/js/main.js + assets/js/fx/*.js + assets/js/sections/NAME.js -> assets/dist/site.js

Markers in the template:
    <!-- @section NAME -->  -> contents of src/partials/NAME.html (left as-is if missing)
    <!-- @css -->           -> <link> to the CSS bundle
    <!-- @js -->            -> <script> for the JS bundle
"""
import argparse
import hashlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDER = ["hero", "process", "about", "skills", "path", "cert", "work", "journal", "hobbies", "contact"]
FX = ["loader", "fluid", "scramble", "ripple"]
DIST = os.path.join(ROOT, "assets", "dist")


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def existing(paths):
    return [p for p in paths if os.path.exists(os.path.join(ROOT, p))]


def css_files():
    return existing(["assets/css/main.css"] + ["assets/css/sections/%s.css" % n for n in ORDER])


def js_files():
    return existing(
        ["assets/js/main.js"]
        + ["assets/js/fx/%s.js" % n for n in FX]
        + ["assets/js/sections/%s.js" % n for n in ORDER]
    )


URL_RE = re.compile(r"url\(\s*([\"']?)([^\"')]+)\1\s*\)")


def rebase_urls(css, src_rel):
    """Rewrite relative url(...) paths so they still work from assets/dist/."""
    src_dir = os.path.dirname(os.path.join(ROOT, src_rel))

    def fix(m):
        quote, url = m.group(1), m.group(2)
        if re.match(r"^(data:|https?:|/|#|%23)", url):
            return m.group(0)
        target = os.path.normpath(os.path.join(src_dir, url))
        return "url(%s%s%s)" % (quote, os.path.relpath(target, DIST).replace(os.sep, "/"), quote)

    return URL_RE.sub(fix, css)


def minify_css(css):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    lines = (line.strip() for line in css.splitlines())
    return "\n".join(line for line in lines if line) + "\n"


def minify_js(js):
    # conservative: drop block comments that start a line, // comment lines and
    # indentation; never touches code inside a line, so strings are safe
    js = re.sub(r"(?m)^\s*/\*.*?\*/[ \t]*$", "", js, flags=re.S)
    out = []
    for line in js.splitlines():
        s = line.strip()
        if not s or s.startswith("//"):
            continue
        out.append(s)
    return "\n".join(out) + "\n"


def bundle(files, kind):
    parts = []
    for rel in files:
        text = read(os.path.join(ROOT, rel))
        if kind == "css":
            parts.append(minify_css(rebase_urls(text, rel)))
        else:
            parts.append(";" + minify_js(text))
    data = "".join(parts)
    os.makedirs(DIST, exist_ok=True)
    with open(os.path.join(DIST, "site." + kind), "w", encoding="utf-8") as f:
        f.write(data)
    return hashlib.sha1(data.encode("utf-8")).hexdigest()[:10]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "index.html"))
    args = ap.parse_args()

    html = read(os.path.join(ROOT, "src", "index.template.html"))

    def section(m):
        path = os.path.join(ROOT, "src", "partials", m.group(1) + ".html")
        return read(path).strip("\n") if os.path.exists(path) else m.group(0)

    html = re.sub(r"<!-- @section ([a-z0-9-]+) -->", section, html)

    css_v = bundle(css_files(), "css")
    js_v = bundle(js_files(), "js")
    html = html.replace("<!-- @css -->", '<link rel="stylesheet" href="assets/dist/site.css?v=%s">' % css_v)
    html = html.replace("<!-- @js -->", '<script src="assets/dist/site.js?v=%s"></script>' % js_v)

    with open(args.out, "w", encoding="utf-8") as f:
        f.write(html)
    for name in ("site.css", "site.js"):
        print("wrote assets/dist/%s (%d KB)" % (name, os.path.getsize(os.path.join(DIST, name)) // 1024))
    print("wrote", os.path.relpath(args.out, ROOT) if args.out.startswith(ROOT) else args.out)


if __name__ == "__main__":
    main()
