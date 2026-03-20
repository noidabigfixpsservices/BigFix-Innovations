from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import subprocess
import os
import tempfile
import json
import uuid
import sqlite3
import sys
import logging
import shutil
import requests

# --- 1. ENTERPRISE CLOUD SYNC CONFIG ---
# This is YOUR exact GitHub URL!
REMOTE_LIBRARY_URL = "https://raw.githubusercontent.com/utkarshup/Bigfix-Studio-JSON-Library/main/library.json"

def get_base_path():
    try:
        return sys._MEIPASS 
    except Exception:
        return os.path.abspath(".")

BASE_DIR = get_base_path()
BUNDLED_LIBRARY_FILE = os.path.join(BASE_DIR, "library.json")

# --- 2. APPDATA, SQLITE, BACKUPS & LOGGING SETUP ---
APPDATA_DIR = os.path.join(os.environ.get('APPDATA', ''), 'BigFixStudio')
os.makedirs(APPDATA_DIR, exist_ok=True)

# Setup Logging
import logging.handlers

LOG_DIR = os.path.join(APPDATA_DIR, 'logs')
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, 'app.log')

# Upgraded to Rotating Logs (Max 5MB per file, keep 2 backups)
rotating_handler = logging.handlers.RotatingFileHandler(
    LOG_FILE, maxBytes=5*1024*1024, backupCount=2
)
logging.basicConfig(
    handlers=[rotating_handler], 
    level=logging.INFO, 
    format='%(asctime)s - %(levelname)s - %(message)s', 
    datefmt='%Y-%m-%d %I:%M:%S %p'
)
logging.info("=== BigFix Studio Backend Initialized ===")

# Database Paths
DB_PATH = os.path.join(APPDATA_DIR, 'userdata.db')
DB_BACKUP_PATH = os.path.join(APPDATA_DIR, 'userdata_backup.db')
CACHE_LIBRARY_FILE = os.path.join(APPDATA_DIR, 'library_cache.json')

def init_db_and_backup():
    # AUTO-BACKUP: If DB exists, back it up before we do anything
    if os.path.exists(DB_PATH):
        try:
            shutil.copy2(DB_PATH, DB_BACKUP_PATH)
            logging.info("Successfully created userdata.db backup.")
        except Exception as e:
            logging.error(f"Failed to create database backup: {e}")

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS custom_snippets (id TEXT PRIMARY KEY, category TEXT, title TEXT, type TEXT, query TEXT, description TEXT, isFavorite INTEGER, updated_at TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS core_favorites (id TEXT PRIMARY KEY, isFavorite INTEGER)''')
        conn.commit()
        conn.close()
    except Exception as e:
        logging.error(f"Failed to initialize SQLite database: {e}")

init_db_and_backup()

# --- 3. FASTAPI SETUP ---
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class RelevanceRequest(BaseModel): query: str
class Snippet(BaseModel): category: str; title: str; type: str; query: str; description: Optional[str] = ""; isFavorite: Optional[bool] = False; updated_at: Optional[str] = ""
class SnippetUpdate(BaseModel): isFavorite: Optional[bool] = None; description: Optional[str] = None; query: Optional[str] = None; title: Optional[str] = None

# --- 4. API ENDPOINTS ---
def fetch_core_library():
    """Fetches the latest library from Cloud, falls back to Cache, then falls back to Bundled."""
    try:
        response = requests.get(REMOTE_LIBRARY_URL, timeout=3)
        if response.status_code == 200:
            remote_data = response.json()
            with open(CACHE_LIBRARY_FILE, 'w') as f:
                json.dump(remote_data, f)
            logging.info("Successfully synced Core Library from GitHub.")
            return remote_data
    except Exception as e:
        logging.warning(f"Could not reach GitHub Library (User might be offline). Error: {e}")

    if os.path.exists(CACHE_LIBRARY_FILE):
        logging.info("Loading Core Library from Local Cache.")
        with open(CACHE_LIBRARY_FILE, 'r') as f: return json.load(f)
    
    if os.path.exists(BUNDLED_LIBRARY_FILE):
        logging.info("Loading Core Library from Bundled Exe.")
        with open(BUNDLED_LIBRARY_FILE, 'r') as f: return json.load(f)
        
    return []

@app.get("/api/library")
async def get_library():
    core_library = fetch_core_library()
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        c.execute("SELECT * FROM core_favorites")
        core_favs = {row["id"]: bool(row["isFavorite"]) for row in c.fetchall()}
        for item in core_library:
            if item["id"] in core_favs: item["isFavorite"] = core_favs[item["id"]]

        c.execute("SELECT * FROM custom_snippets")
        custom_snippets = [dict(row) for row in c.fetchall()]
        for snip in custom_snippets: snip["isFavorite"] = bool(snip["isFavorite"]) 

        conn.close()
        return core_library + custom_snippets
    except Exception as e:
        logging.error(f"Failed to fetch library: {str(e)}")
        return core_library

@app.post("/api/library")
async def add_snippet(snippet: Snippet):
    new_id = str(uuid.uuid4())
    updated_at = datetime.now().strftime("%b %d, %Y - %I:%M %p")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""INSERT INTO custom_snippets (id, category, title, type, query, description, isFavorite, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", (new_id, snippet.category, snippet.title, snippet.type, snippet.query, snippet.description, 0, updated_at))
    conn.commit()
    conn.close()
    
    snippet_dict = snippet.dict()
    snippet_dict["id"] = new_id
    snippet_dict["updated_at"] = updated_at
    return {"message": "Success", "snippet": snippet_dict}

@app.put("/api/library/{snippet_id}")
async def update_snippet(snippet_id: str, update: SnippetUpdate):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    if len(snippet_id) < 20: 
        if update.isFavorite is not None:
            c.execute("INSERT OR REPLACE INTO core_favorites (id, isFavorite) VALUES (?, ?)", (snippet_id, int(update.isFavorite)))
    else: 
        updates = []
        params = []
        if update.isFavorite is not None: updates.append("isFavorite = ?"); params.append(int(update.isFavorite))
        if update.description is not None: updates.append("description = ?"); params.append(update.description)
        if update.query is not None: updates.append("query = ?"); params.append(update.query)
        if update.title is not None: updates.append("title = ?"); params.append(update.title)
            
        if update.query is not None or update.title is not None:
            updates.append("updated_at = ?"); params.append(datetime.now().strftime("%b %d, %Y - %I:%M %p"))
            
        if updates:
            query = f"UPDATE custom_snippets SET {', '.join(updates)} WHERE id = ?"
            params.append(snippet_id)
            c.execute(query, params)
            
    conn.commit()
    conn.close()
    return {"message": "Updated successfully"}

@app.delete("/api/library/{snippet_id}")
async def delete_snippet(snippet_id: str):
    if len(snippet_id) < 20: raise HTTPException(status_code=403, detail="Cannot delete core library items.")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM custom_snippets WHERE id = ?", (snippet_id,))
    conn.commit()
    conn.close()
    return {"message": "Deleted successfully"}

# --- 5. EXECUTION ENGINES ---
@app.post("/api/run-relevance")
async def run_relevance(req: RelevanceRequest):
    qna_path = r"C:\Program Files (x86)\BigFix Enterprise\BES Client\qna.exe"
    if not os.path.exists(qna_path): raise HTTPException(status_code=500, detail="qna.exe not found.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".bes", mode="w") as temp_file:
        temp_file.write(f"Q: {req.query}\n")
        temp_file_path = temp_file.name
    try:
        process = subprocess.Popen([qna_path, temp_file_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        stdout, stderr = process.communicate(timeout=15)
        lines = [line for line in stdout.split('\n') if line.startswith(('A:', 'E:', 'T:'))]
        result_text = "\n".join(lines)
        if not result_text: return {"result": f"Raw Output:\n{stdout}\nErrors:\n{stderr}"}
        return {"result": result_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_file_path): os.remove(temp_file_path)

@app.post("/api/run-actionscript")
async def run_actionscript(req: RelevanceRequest):
    fd_paths = [r"C:\Program Files (x86)\BigFix Enterprise\BES Console\QnA\FixletDebugger.exe", r"C:\Program Files (x86)\BigFix Enterprise\BES Console\FixletDebugger.exe", r"C:\Program Files (x86)\BigFix Enterprise\BES Client\FixletDebugger.exe"]
    fd_path = next((p for p in fd_paths if os.path.exists(p)), None)
    if not fd_path: raise HTTPException(status_code=500, detail="Fixlet Debugger is not installed. As a prerequisite for testing ActionScript, please go to download.bigfix.com and download the compatible version to use BigFix Studio for ActionScripts.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".bfa", mode="w") as in_file:
        in_file.write(req.query)
        in_file_path = in_file.name
    out_file_path = in_file_path + "_out.txt"
 
    try:
        process = subprocess.Popen([fd_path, "/a", in_file_path, out_file_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        stdout, stderr = process.communicate(timeout=30) 
        if os.path.exists(out_file_path):
            with open(out_file_path, 'r') as f: result_text = f.read()
            if not result_text.strip(): return {"result": f"Action completed, but no standard output was logged.\nConsole output:\n{stdout}"}
            return {"result": result_text}
        else:
            return {"result": f"Action log file not generated. Action may have failed.\nConsole output:\n{stdout}\nErrors:\n{stderr}"}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="ActionScript execution timed out after 30 seconds.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(in_file_path): os.remove(in_file_path)
        if os.path.exists(out_file_path): os.remove(out_file_path)

# --- 6. SERVE REACT FRONTEND (STATIC FILES) ---
dist_path = os.path.join(BASE_DIR, "ui")
if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        file_path = os.path.join(dist_path, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path): return FileResponse(file_path)
        return FileResponse(os.path.join(dist_path, "index.html"))