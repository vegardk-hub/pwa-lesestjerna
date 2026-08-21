"""Utviklingsserver for Lesestjerna -- akkurat som 'python -m http.server',
men uten mellomlagring i nettleseren.

http.server sender ingen Cache-Control, saa nettlesere kan velge aa bruke en
gammel kopi av en fil lenge etter at den er endret paa disk, uten en gang aa
sjekke med serveren foerst. Under vanlig bruk merkes det knapt, men midt i
utvikling -- der en fil kan endre seg hvert minutt -- fikk det appen til aa
kjoere gammel, fjernet kode og krasje paa maater som saa ut som ekte bugs.

Kjor akkurat som foer:  python serve.py [port]
"""

import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class UtenMellomlagring(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    HTTPServer(("", port), UtenMellomlagring).serve_forever()
