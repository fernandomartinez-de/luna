#!/usr/bin/env python3
"""
Auto-processing dashboard server

Serves the dashboard and handles automatic processing pipeline:
1. Detects files in inbox
2. Processes them (inbox → bronze)
3. Loads to database
4. Refreshes dashboard
"""
import os
import subprocess
import sys
from pathlib import Path
from flask import Flask, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Paths
REPO_ROOT = Path(__file__).parent
VAULT_ROOT = Path(r"C:\Users\fmartine\Personal\vaults\ssc-vault-fm")
INBOX_FOLDER = VAULT_ROOT / "inbox" / "finances"
DASHBOARD_FILE = REPO_ROOT / "finances.html"

# Processing state
processing_state = {
    "status": "idle",  # idle, processing, complete, error
    "step": None,
    "message": None,
    "error": None
}


@app.route('/')
def dashboard():
    """Serve the main dashboard"""
    return send_file(str(DASHBOARD_FILE))


@app.route('/api/check-inbox')
def check_inbox():
    """Check if there are files in inbox to process"""
    files = list(INBOX_FOLDER.glob("*.xlsx")) + list(INBOX_FOLDER.glob("*.csv"))
    files = [f for f in files if f.name != "README.md"]

    return jsonify({
        "has_files": len(files) > 0,
        "file_count": len(files),
        "files": [f.name for f in files]
    })


@app.route('/api/process', methods=['POST'])
def process_pipeline():
    """Run the full processing pipeline"""
    global processing_state

    processing_state = {
        "status": "processing",
        "step": "Starting...",
        "message": None,
        "error": None
    }

    try:
        # Step 1: Process inbox
        processing_state["step"] = "Processing inbox"
        processing_state["message"] = "Moving files from inbox to bronze..."

        result = subprocess.run(
            [sys.executable, str(REPO_ROOT / "scripts" / "process_finances_inbox.py")],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT)
        )

        if result.returncode != 0:
            raise Exception(f"Inbox processing failed: {result.stderr}")

        # Step 2: Load bronze to database
        processing_state["step"] = "Loading to database"
        processing_state["message"] = "Categorizing and loading transactions..."

        result = subprocess.run(
            [sys.executable, str(REPO_ROOT / "scripts" / "load_bronze.py")],
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT)
        )

        if result.returncode != 0:
            raise Exception(f"Database load failed: {result.stderr}")

        # Complete
        processing_state["status"] = "complete"
        processing_state["step"] = "Complete"
        processing_state["message"] = "All data loaded successfully"

        return jsonify({
            "success": True,
            "message": "Processing complete"
        })

    except Exception as e:
        processing_state["status"] = "error"
        processing_state["error"] = str(e)

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/api/status')
def get_status():
    """Get current processing status"""
    return jsonify(processing_state)


@app.route('/api/reset')
def reset_status():
    """Reset processing state"""
    global processing_state
    processing_state = {
        "status": "idle",
        "step": None,
        "message": None,
        "error": None
    }
    return jsonify({"success": True})


if __name__ == '__main__':
    print("="*80)
    print("FINANCES DASHBOARD SERVER")
    print("="*80)
    print(f"Dashboard: http://localhost:8000")
    print(f"Inbox: {INBOX_FOLDER}")
    print("="*80)
    print("\nAuto-processing enabled:")
    print("  1. Drop Excel files in inbox")
    print("  2. Open http://localhost:8000")
    print("  3. Dashboard auto-detects and processes")
    print("\nServer starting...")
    print("="*80)

    app.run(host='localhost', port=8000, debug=False)
