from fastapi import FastAPI, HTTPException, Body
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
import xml.etree.ElementTree as ET
import urllib3

# Disable SSL Warnings for BigFix Self-Signed Certs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- 1. ENTERPRISE CLOUD SYNC CONFIG ---
REMOTE_LIBRARY_URL = "https://raw.githubusercontent.com/utkarshup/Bigfix-Studio-JSON-Library/main/library.json"

def get_base_path():
    try: return sys._MEIPASS 
    except Exception: return os.path.abspath(".")

BASE_DIR = get_base_path()
BUNDLED_LIBRARY_FILE = os.path.join(BASE_DIR, "library.json")

# --- 2. APPDATA, SQLITE, BACKUPS & LOGGING SETUP ---
APPDATA_DIR = os.path.join(os.environ.get('APPDATA', ''), 'BigFixStudio')
os.makedirs(APPDATA_DIR, exist_ok=True)

import logging.handlers
LOG_DIR = os.path.join(APPDATA_DIR, 'logs')
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, 'app.log')

rotating_handler = logging.handlers.RotatingFileHandler(LOG_FILE, maxBytes=5*1024*1024, backupCount=2)
logging.basicConfig(handlers=[rotating_handler], level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', datefmt='%Y-%m-%d %I:%M:%S %p')
logging.info("=== BigFix Studio Backend Initialized ===")

DB_PATH = os.path.join(APPDATA_DIR, 'userdata.db')
DB_BACKUP_PATH = os.path.join(APPDATA_DIR, 'userdata_backup.db')
CACHE_LIBRARY_FILE = os.path.join(APPDATA_DIR, 'library_cache.json')

def init_db_and_backup():
    if os.path.exists(DB_PATH):
        try: shutil.copy2(DB_PATH, DB_BACKUP_PATH)
        except Exception as e: logging.error(f"Failed to create database backup: {e}")

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS custom_snippets (id TEXT PRIMARY KEY, category TEXT, title TEXT, type TEXT, query TEXT, description TEXT, isFavorite INTEGER, updated_at TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS core_favorites (id TEXT PRIMARY KEY, isFavorite INTEGER)''')
        c.execute('''CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, query TEXT, timestamp TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)''')
        conn.commit()
        conn.close()
    except Exception as e: logging.error(f"Failed to initialize SQLite database: {e}")

init_db_and_backup()

# --- 3. FASTAPI SETUP ---
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class RelevanceRequest(BaseModel): query: str
class Snippet(BaseModel): category: str; title: str; type: str; query: str; description: Optional[str] = ""; isFavorite: Optional[bool] = False; updated_at: Optional[str] = ""
class SnippetUpdate(BaseModel): isFavorite: Optional[bool] = None; description: Optional[str] = None; query: Optional[str] = None; title: Optional[str] = None
class BesExportRequest(BaseModel): title: str; relevance: str; actionscript: str
class SettingsData(BaseModel): url: str; username: str; password: str
class RemoteQueryRequest(BaseModel): query: str; target: str

# --- 4. API ENDPOINTS ---
def fetch_core_library():
    try:
        response = requests.get(REMOTE_LIBRARY_URL, timeout=3)
        if response.status_code == 200:
            remote_data = response.json()
            with open(CACHE_LIBRARY_FILE, 'w') as f: json.dump(remote_data, f)
            return remote_data
    except Exception as e: pass

    if os.path.exists(CACHE_LIBRARY_FILE):
        with open(CACHE_LIBRARY_FILE, 'r') as f: return json.load(f)
    if os.path.exists(BUNDLED_LIBRARY_FILE):
        with open(BUNDLED_LIBRARY_FILE, 'r') as f: return json.load(f)
    return []

@app.get("/api/library")
async def get_library():
    core_library = fetch_core_library()
    try:
        conn = sqlite3.connect(DB_PATH); conn.row_factory = sqlite3.Row; c = conn.cursor()
        c.execute("SELECT * FROM core_favorites")
        core_favs = {row["id"]: bool(row["isFavorite"]) for row in c.fetchall()}
        
        # MIGRATION: Convert old 'relevance' to 'client-relevance' on the fly
        for item in core_library:
            if item.get("type") == "relevance": item["type"] = "client-relevance"
            if item["id"] in core_favs: item["isFavorite"] = core_favs[item["id"]]
            
        c.execute("SELECT * FROM custom_snippets")
        custom_snippets = [dict(row) for row in c.fetchall()]
        for snip in custom_snippets:
            if snip.get("type") == "relevance": snip["type"] = "client-relevance"
            snip["isFavorite"] = bool(snip["isFavorite"]) 
            
        conn.close()
        return core_library + custom_snippets
    except Exception as e: return core_library

@app.post("/api/library")
async def add_snippet(snippet: Snippet):
    new_id = str(uuid.uuid4()); updated_at = datetime.now().strftime("%b %d, %Y - %I:%M %p")
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute("""INSERT INTO custom_snippets (id, category, title, type, query, description, isFavorite, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", (new_id, snippet.category, snippet.title, snippet.type, snippet.query, snippet.description, 0, updated_at))
    conn.commit(); conn.close()
    snippet_dict = snippet.dict(); snippet_dict["id"] = new_id; snippet_dict["updated_at"] = updated_at
    return {"message": "Success", "snippet": snippet_dict}

@app.put("/api/library/{snippet_id}")
async def update_snippet(snippet_id: str, update: SnippetUpdate):
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    if len(snippet_id) < 20: 
        if update.isFavorite is not None: c.execute("INSERT OR REPLACE INTO core_favorites (id, isFavorite) VALUES (?, ?)", (snippet_id, int(update.isFavorite)))
    else: 
        updates = []; params = []
        if update.isFavorite is not None: updates.append("isFavorite = ?"); params.append(int(update.isFavorite))
        if update.description is not None: updates.append("description = ?"); params.append(update.description)
        if update.query is not None: updates.append("query = ?"); params.append(update.query)
        if update.title is not None: updates.append("title = ?"); params.append(update.title)
        if update.query is not None or update.title is not None: updates.append("updated_at = ?"); params.append(datetime.now().strftime("%b %d, %Y - %I:%M %p"))
        if updates: query = f"UPDATE custom_snippets SET {', '.join(updates)} WHERE id = ?"; params.append(snippet_id); c.execute(query, params)
    conn.commit(); conn.close()
    return {"message": "Updated successfully"}

@app.delete("/api/library/{snippet_id}")
async def delete_snippet(snippet_id: str):
    if len(snippet_id) < 20: raise HTTPException(status_code=403, detail="Cannot delete core library items.")
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute("DELETE FROM custom_snippets WHERE id = ?", (snippet_id,))
    conn.commit(); conn.close()
    return {"message": "Deleted successfully"}

@app.get("/api/history")
def get_history(limit: int = 50):
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute("SELECT id, type, query, timestamp FROM history ORDER BY id DESC LIMIT ?", (limit,))
    rows = c.fetchall(); conn.close()
    return [{"id": r[0], "type": r[1], "query": r[2], "timestamp": r[3]} for r in rows]

@app.post("/api/history")
def add_history(item: dict = Body(...)):
    query_text = item.get("query", "").strip(); query_type = item.get("type", "client-relevance")
    if not query_text: return {"status": "skipped"}
    timestamp = datetime.now().strftime("%b %d, %Y - %I:%M %p")
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute("INSERT INTO history (type, query, timestamp) VALUES (?, ?, ?)", (query_type, query_text, timestamp))
    c.execute("""DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT 100)""")
    conn.commit(); conn.close()
    return {"status": "success"}

@app.delete("/api/history")
def clear_history():
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute("DELETE FROM history"); conn.commit(); conn.close()
    return {"status": "cleared"}

@app.post("/api/export-bes")
async def export_bes(req: BesExportRequest):
    title = req.title.strip() or "Custom BigFix Studio Fixlet"
    rel = req.relevance.strip() or "true"; act = req.actionscript.strip() or ""
    date_str = datetime.now().strftime('%Y-%m-%d')
    xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>\n<BES xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="BES.xsd">\n    <Fixlet>\n        <Title>{title}</Title>\n        <Description><![CDATA[Generated by BigFix Studio.]]></Description>\n        <Relevance><![CDATA[{rel}]]></Relevance>\n        <Category>Custom</Category>\n        <Source>Internal</Source>\n        <SourceReleaseDate>{date_str}</SourceReleaseDate>\n        <Domain>BESC</Domain>\n        <DefaultAction ID="Action1">\n            <Description>\n                <PreLink>Click </PreLink>\n                <Link>here</Link>\n                <PostLink> to deploy this action.</PostLink>\n            </Description>\n            <ActionScript MIMEType="application/x-Fixlet-Windows-Shell"><![CDATA[{act}]]></ActionScript>\n        </DefaultAction>\n    </Fixlet>\n</BES>"""
    return {"xml": xml_content}

# --- 5. SETTINGS & REMOTE QUERY ENDPOINTS ---

# Create a global session for TCP connection pooling & Keep-Alive (Massive Speed Boost)
api_session = requests.Session()
api_session.verify = False

@app.get("/api/settings")
def get_settings():
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute("SELECT key, value FROM settings")
    rows = c.fetchall(); conn.close()
    settings = {"url": "", "username": "", "password": ""}
    for k, v in rows:
        if k in settings: settings[k] = v
    return settings

@app.post("/api/settings")
def save_settings(s: SettingsData):
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('url', ?)", (s.url,))
    c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('username', ?)", (s.username,))
    c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('password', ?)", (s.password,))
    conn.commit(); conn.close()
    return {"status": "success"}

@app.post("/api/test-connection")
def test_connection(s: SettingsData):
    """Pings the BigFix Root Server and warms up the Session Cookie"""
    url = s.url.strip().rstrip('/')
    if not url or not s.username:
        raise HTTPException(status_code=400, detail="URL and Username are required.")
    try:
        api_session.auth = (s.username, s.password)
        response = api_session.get(f"{url}/api/login", timeout=10)
        if response.status_code == 200:
            return {"status": "success", "message": "Connection successful! TCP Keep-Alive is active."}
        else:
            raise HTTPException(status_code=response.status_code, detail=f"Authentication failed (HTTP {response.status_code})")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to reach server. Ensure URL is reachable.")

@app.post("/api/run-session-relevance")
def run_session_relevance(req: RelevanceRequest):
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute("SELECT key, value FROM settings"); settings = dict(c.fetchall()); conn.close()

    url = settings.get("url", "").strip().rstrip('/')
    username = settings.get("username", ""); password = settings.get("password", "")

    if not url or not username:
        raise HTTPException(status_code=400, detail="BigFix REST API credentials not configured. Please click the Server icon to configure.")

    # ?output=json forces lightning-fast JSON data instead of bulky XML trees
    req_url = f"{url}/api/query?output=json"
    data = {'relevance': req.query}

    try:
        api_session.auth = (username, password)
        # Using api_session instead of requests.post reuses the established SSL socket!
        response = api_session.post(req_url, data=data, timeout=60)
        
        if response.status_code != 200:
            return {"result": f"E: HTTP {response.status_code} Error from BigFix Server\n{response.text}"}

        try:
            # 1. Try parsing the instant JSON payload
            res_data = response.json()
            
            if "error" in res_data: return {"result": f"E: {res_data['error']}"}
            
            answers = res_data.get("result", [])
            if not isinstance(answers, list): answers = [answers]
                
            result_lines = [f"A: {str(ans)}" for ans in answers]
            
            if "evaltime_ms" in res_data:
                result_lines.append(f"T: {res_data['evaltime_ms']} ms")
                
            if not result_lines: return {"result": "Execution completed successfully, but returned no results."}
            return {"result": "\n".join(result_lines)}

        except ValueError:
            # 2. Bulletproof Fallback: Parse XML if an older BigFix server ignores the JSON request
            root = ET.fromstring(response.text)
            answers = root.findall(".//Answer")
            error = root.find(".//Error")

            if error is not None: return {"result": f"E: {error.text}"}
            result_lines = [f"A: {ans.text}" for ans in answers]
            time_tag = root.find(".//Time")
            if time_tag is not None: result_lines.append(f"T: {time_tag.text}")
            
            if not result_lines: return {"result": "Execution completed successfully, but returned no results."}
            return {"result": "\n".join(result_lines)}

    except requests.exceptions.ConnectionError: raise HTTPException(status_code=500, detail=f"Connection Error: Could not reach {url}.")
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))


class RemoteQueryRequest(BaseModel): query: str; target: str

@app.post("/api/run-remote-query")
def run_remote_query(req: RemoteQueryRequest):
    """Dispatches a query to an endpoint using BigFix native targeting."""
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute("SELECT key, value FROM settings"); settings = dict(c.fetchall()); conn.close()
    url = settings.get("url", "").strip().rstrip('/')
    username = settings.get("username", ""); password = settings.get("password", "")
    
    if not url or not username: raise HTTPException(status_code=400, detail="API credentials not configured.")
    api_session.auth = (username, password)
    target_val = req.target.strip()

    # NATIVE SMART TARGETING: Let BigFix handle the ID vs Hostname routing
    if target_val.isdigit():
        target_xml = f"<ComputerID>{target_val}</ComputerID>"
    else:
        target_xml = f"<ComputerName>{target_val}</ComputerName>"

    # DISPATCH THE CLIENT QUERY
    cq_url = f"{url}/api/clientquery"
    xml_payload = f"""<?xml version="1.0" encoding="UTF-8"?>
    <BESAPI xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="BESAPI.xsd">
        <ClientQuery>
            <ApplicabilityRelevance>true</ApplicabilityRelevance>
            <QueryText><![CDATA[{req.query}]]></QueryText>
            <Target>
                {target_xml}
            </Target>
        </ClientQuery>
    </BESAPI>"""
    
    try:
        cq_res = api_session.post(cq_url, data=xml_payload, headers={'Content-Type': 'application/xml'}, timeout=10)
        if cq_res.status_code != 200: raise HTTPException(status_code=cq_res.status_code, detail=f"Failed to dispatch query. Check permissions.\n{cq_res.text}")
        
        root = ET.fromstring(cq_res.text)
        query_id_elem = root.find(".//ID")
        if query_id_elem is None: raise HTTPException(status_code=500, detail="Failed to parse Query ID from BigFix.")
        
        return {"query_id": query_id_elem.text, "target_id": target_val}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/client-query-results/{query_id}")
def get_client_query_results(query_id: str):
    """Polls the Root Server for the endpoint's execution results."""
    conn = sqlite3.connect(DB_PATH); c = conn.cursor()
    c.execute("SELECT key, value FROM settings"); settings = dict(c.fetchall()); conn.close()
    url = settings.get("url", "").strip().rstrip('/')
    api_session.auth = (settings.get("username", ""), settings.get("password", ""))
    
    try:
        res = api_session.get(f"{url}/api/clientqueryresults/{query_id}", timeout=10)
        if res.status_code != 200: raise HTTPException(status_code=res.status_code, detail="Failed to fetch results.")
        
        root = ET.fromstring(res.text)
        query_results = root.findall(".//QueryResult")
        
        # If there are no QueryResult tags, the endpoint hasn't reported back yet
        if not query_results:
            return {"status": "Waiting", "result": None}
        
        result_lines = []
        for q_res in query_results:
            is_failure = q_res.find(".//IsFailure")
            failure_flag = True if (is_failure is not None and is_failure.text == "1") else False
            
            # BigFix puts the answers/errors inside <Result> tags
            for res_node in q_res.findall(".//Result"):
                val = res_node.text if res_node.text else ""
                if failure_flag:
                    result_lines.append(f"E: {val}")
                else:
                    result_lines.append(f"A: {val}")
                    
        if not result_lines: 
            result_lines = ["Execution completed successfully, but returned no results."]
            
        return {"status": "Responded", "result": "\n".join(result_lines)}
            
    except Exception as e: 
        raise HTTPException(status_code=500, detail=str(e))
    
    
# --- 6. LOCAL EXECUTION ENGINES ---
@app.post("/api/run-relevance")
async def run_relevance(req: RelevanceRequest):
    qna_path = r"C:\Program Files (x86)\BigFix Enterprise\BES Client\qna.exe"
    if not os.path.exists(qna_path): raise HTTPException(status_code=500, detail="qna.exe not found.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".bes", mode="w") as temp_file:
        temp_file.write(f"Q: {req.query}\n"); temp_file_path = temp_file.name
    try:
        process = subprocess.Popen([qna_path, temp_file_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        stdout, stderr = process.communicate(timeout=15)
        lines = [line for line in stdout.split('\n') if line.startswith(('A:', 'E:', 'T:'))]
        result_text = "\n".join(lines)
        if not result_text: return {"result": f"Raw Output:\n{stdout}\nErrors:\n{stderr}"}
        return {"result": result_text}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_file_path): os.remove(temp_file_path)

@app.post("/api/run-actionscript")
async def run_actionscript(req: RelevanceRequest):
    fd_paths = [r"C:\Program Files (x86)\BigFix Enterprise\BES Console\QnA\FixletDebugger.exe", r"C:\Program Files (x86)\BigFix Enterprise\BES Console\FixletDebugger.exe", r"C:\Program Files (x86)\BigFix Enterprise\BES Client\FixletDebugger.exe"]
    fd_path = next((p for p in fd_paths if os.path.exists(p)), None)
    if not fd_path: raise HTTPException(status_code=500, detail="Fixlet Debugger is not installed.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".bfa", mode="w") as in_file:
        in_file.write(req.query); in_file_path = in_file.name
    out_file_path = in_file_path + "_out.txt"
 
    try:
        process = subprocess.Popen([fd_path, "/a", in_file_path, out_file_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        stdout, stderr = process.communicate(timeout=30) 
        if os.path.exists(out_file_path):
            with open(out_file_path, 'r') as f: result_text = f.read()
            if not result_text.strip(): return {"result": f"Action completed, but no standard output was logged.\nConsole output:\n{stdout}"}
            return {"result": result_text}
        else:
            return {"result": f"Action log file not generated.\nConsole output:\n{stdout}\nErrors:\n{stderr}"}
    except subprocess.TimeoutExpired: raise HTTPException(status_code=408, detail="ActionScript execution timed out after 30 seconds.")
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(in_file_path): os.remove(in_file_path)
        if os.path.exists(out_file_path): os.remove(out_file_path)

# --- 7. SERVE REACT FRONTEND ---
dist_path = os.path.join(BASE_DIR, "ui")
assets_path = os.path.join(dist_path, "assets")

if os.path.exists(dist_path):
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")
        
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        file_path = os.path.join(dist_path, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path): 
            return FileResponse(file_path)
            
        index_path = os.path.join(dist_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
            
        # SAFETY NET: If index.html is missing, show a clear error instead of crashing
        return HTMLResponse(
            f"<h1>UI Build Missing!</h1><p>The executable could not find the UI files inside itself. Path checked: {index_path}</p>", 
            status_code=404
        )