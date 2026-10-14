#!/usr/bin/env python3
"""Assemble index.html from src/index.template.html and the section partials.

    python3 src/build.py                 # writes ./index.html
    python3 src/build.py --out some.html # writes elsewhere (used for previews)

Markers in the template:
    <!-- @section NAME -->  -> contents of src/partials/NAME.html (left as-is if missing)
    <!-- @styles -->        -> <link> for each assets/css/sections/NAME.css that exists
    <!-- @scripts -->       -> <script> for each assets/js/sections/NAME.js that exists
"""
import argparse
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDER = ["hero", "process", "about", "skills", "path", "cert", "work", "journal", "hobbies", "contact"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "index.html"))
    args = ap.parse_args()

    with open(os.path.join(ROOT, "src", "index.template.html"), encoding="utf-8") as f:
        html = f.read()

    def section(m):
        name = m.group(1)
        path = os.path.join(ROOT, "src", "partials", name + ".html")
        if not os.path.exists(path):
            return m.group(0)
        with open(path, encoding="utf-8") as f:
            return f.read().strip("\n")

    html = re.sub(r"<!-- @section ([a-z0-9-]+) -->", section, html)

    styles = [
        '  <link rel="stylesheet" href="assets/css/sections/%s.css">' % n
        for n in ORDER
        if os.path.exists(os.path.join(ROOT, "assets", "css", "sections", n + ".css"))
    ]
    scripts = [
        '<script src="assets/js/sections/%s.js"></script>' % n
        for n in ORDER
        if os.path.exists(os.path.join(ROOT, "assets", "js", "sections", n + ".js"))
    ]
    html = html.replace("  <!-- @styles -->", "\n".join(styles))
    html = html.replace("<!-- @scripts -->", "\n".join(scripts))

    with open(args.out, "w", encoding="utf-8") as f:
        f.write(html)
    print("wrote", os.path.relpath(args.out, ROOT) if args.out.startswith(ROOT) else args.out)


if __name__ == "__main__":
    main()
