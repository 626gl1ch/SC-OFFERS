#!/usr/bin/env python3
"""
SC-OFFERS Local Backend & Live Sync Server (Production-Ready)
Zero-dependency Python 3 HTTP server with REST endpoints for:
- Saving CPA offers directly to data/offers.json
- Automatically committing and pushing changes via git CLI
- Tracking clicks and completion events
- Health monitoring and CORS support
"""

import os
import sys
import json
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

# Ensure stdout and stderr handle unicode safely on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

PORT = int(os.environ.get("PORT", 8080))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
OFFERS_FILE = os.path.join(DATA_DIR, "offers.json")
TRACKING_FILE = os.path.join(DATA_DIR, "tracking.json")

os.makedirs(DATA_DIR, exist_ok=True)

class SCOffersHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Always inject CORS and cache prevention headers for API & data files
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        if self.path.endswith(".json") or self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        # Health endpoint: /api/health
        if parsed.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            offers_count = 0
            if os.path.exists(OFFERS_FILE):
                try:
                    with open(OFFERS_FILE, "r", encoding="utf-8") as f:
                        offers_count = len(json.load(f))
                except Exception:
                    pass
            resp = {
                "status": "healthy",
                "service": "SC-OFFERS Backend",
                "version": "2.0.0",
                "activeOffers": offers_count,
                "port": PORT
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))
            return

        # Offers endpoint: /api/offers
        if parsed.path == "/api/offers":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            if os.path.exists(OFFERS_FILE):
                with open(OFFERS_FILE, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b"[]")
            return

        # Tracking logs endpoint: /api/tracking
        if parsed.path == "/api/tracking":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            if os.path.exists(TRACKING_FILE):
                with open(TRACKING_FILE, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b"[]")
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        
        # Endpoint: /api/save-offers
        if parsed.path == "/api/save-offers":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            try:
                payload = json.loads(body.decode("utf-8"))
                offers_data = payload.get("offers", [])
                if not isinstance(offers_data, list):
                    raise ValueError("Field 'offers' must be a JSON array")
                commit_msg = payload.get("message", "Update CPA offers via Admin Panel")

                # 1. Write to data/offers.json
                with open(OFFERS_FILE, "w", encoding="utf-8") as f:
                    json.dump(offers_data, f, indent=2, ensure_ascii=False)

                # 2. Attempt automatic Git commit & push if git repository exists
                git_status = "Saved locally to disk"
                if os.path.exists(os.path.join(BASE_DIR, ".git")):
                    try:
                        subprocess.run(["git", "add", "data/offers.json"], cwd=BASE_DIR, check=True, capture_output=True)
                        commit_res = subprocess.run(["git", "commit", "-m", commit_msg], cwd=BASE_DIR, capture_output=True, text=True)
                        if commit_res.returncode == 0:
                            push_res = subprocess.run(["git", "push"], cwd=BASE_DIR, capture_output=True, text=True)
                            if push_res.returncode == 0:
                                git_status = "Committed & pushed to remote branch"
                            else:
                                git_status = f"Git push note: {push_res.stderr.strip()[:60]}"
                        else:
                            combined = (commit_res.stdout + commit_res.stderr).lower()
                            if "nothing to commit" in combined:
                                git_status = "Saved locally (already up to date with remote)"
                            else:
                                git_status = f"Git commit note: {commit_res.stderr.strip()[:60]}"
                    except Exception as git_err:
                        git_status = f"Git sync note: {str(git_err)[:60]}"

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
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

        # Endpoint: /api/clear-tracking
        if parsed.path == "/api/clear-tracking":
            try:
                with open(TRACKING_FILE, "w", encoding="utf-8") as f:
                    f.write("[]")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "message": "Tracking logs cleared"}).encode("utf-8"))
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
                if not isinstance(event, dict):
                    raise ValueError("Tracking event must be a JSON object")
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
                self.end_headers()
                self.wfile.write(json.dumps({"status": "logged", "eventsCount": len(tracking_data)}).encode("utf-8"))
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
        self.end_headers()

def run():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, SCOffersHandler)
    print("=======================================================")
    print(f"  [+] SC-OFFERS Local Server running on port {PORT}")
    print(f"  Guest Site:  http://localhost:{PORT}/index.html")
    print(f"  Admin Panel: http://localhost:{PORT}/admin.html")
    print(f"  Health Check: http://localhost:{PORT}/api/health")
    print(f"  Master Password: 554#2Dani.G")
    print("=======================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == "__main__":
    run()
