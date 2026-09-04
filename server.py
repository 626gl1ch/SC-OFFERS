#!/usr/bin/env python3
"""
SC-OFFERS Local Backend & Live Sync Server
Zero-dependency Python 3 HTTP server with REST endpoints for:
- Saving CPA offers directly to data/offers.json
- Automatically committing and pushing changes via git CLI
- Tracking clicks and completion events
"""

import os
import sys
import json
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
OFFERS_FILE = os.path.join(DATA_DIR, "offers.json")
TRACKING_FILE = os.path.join(DATA_DIR, "tracking.json")

os.makedirs(DATA_DIR, exist_ok=True)

class SCOffersHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_POST(self):
        parsed = urlparse(self.path)
        
        # Endpoint: /api/save-offers
        if parsed.path == "/api/save-offers":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                payload = json.loads(body.decode("utf-8"))
                offers_data = payload.get("offers", [])
                commit_msg = payload.get("message", "Update CPA offers via Admin Panel")

                # 1. Write to data/offers.json
                with open(OFFERS_FILE, "w", encoding="utf-8") as f:
                    json.dump(offers_data, f, indent=2, ensure_ascii=False)

                # 2. Attempt automatic Git commit & push if git repository exists
                git_status = "Saved locally"
                if os.path.exists(os.path.join(BASE_DIR, ".git")):
                    try:
                        subprocess.run(["git", "add", "data/offers.json"], cwd=BASE_DIR, check=True, capture_output=True)
                        commit_res = subprocess.run(["git", "commit", "-m", commit_msg], cwd=BASE_DIR, capture_output=True, text=True)
                        push_res = subprocess.run(["git", "push"], cwd=BASE_DIR, capture_output=True, text=True)
                        git_status = f"Committed & pushed: {commit_res.stdout.strip()[:40]}"
                    except Exception as git_err:
                        git_status = f"Git operation note: {str(git_err)}"

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                resp = {
                    "status": "success",
                    "offersCount": len(offers_data),
                    "git": git_status
                }
                self.wfile.write(json.dumps(resp).encode("utf-8"))
                return
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
                return

        # Endpoint: /api/track-click
        if parsed.path == "/api/track-click":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                event = json.loads(body.decode("utf-8"))
                tracking_data = []
                if os.path.exists(TRACKING_FILE):
                    try:
                        with open(TRACKING_FILE, "r", encoding="utf-8") as f:
                            tracking_data = json.load(f)
                    except Exception:
                        tracking_data = []
                tracking_data.insert(0, event)
                if len(tracking_data) > 500:
                    tracking_data = tracking_data[:500]

                with open(TRACKING_FILE, "w", encoding="utf-8") as f:
                    json.dump(tracking_data, f, indent=2, ensure_ascii=False)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "logged"}).encode("utf-8"))
                return
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
                return

        self.send_response(404)
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

def run():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, SCOffersHandler)
    print(f"=======================================================")
    print(f"  SC-OFFERS Server running on http://localhost:{PORT}")
    print(f"  Guest Site: http://localhost:{PORT}/index.html")
    print(f"  Admin Panel: http://localhost:{PORT}/admin.html")
    print(f"  Admin Password: 554#2Dani.G")
    print(f"=======================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == "__main__":
    run()
