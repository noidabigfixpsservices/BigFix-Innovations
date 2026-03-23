import webview
import threading
import uvicorn
import time
import requests
import psutil
import os
import ctypes
import uvicorn
import fastapi
import starlette

# --- 1. FORCE WINDOWS TO USE CRISP 100% SCALING ---
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    pass

os.environ["WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS"] = "--force-device-scale-factor=1"

from main import app, logging

# --- 2. SAFE API BRIDGE (NO CIRCULAR REFERENCES) ---
native_window = None

class Api:
    def toggle_fullscreen(self):
        global native_window
        if native_window:
            native_window.toggle_fullscreen()

def start_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="critical")

def wait_for_server():
    while True:
        try:
            response = requests.get("http://127.0.0.1:8000/api/library")
            if response.status_code == 200:
                break
        except requests.ConnectionError:
            time.sleep(0.1)

def kill_zombie_processes():
    logging.info("App closing. Checking for zombie processes...")
    target_processes = ['qna.exe', 'FixletDebugger.exe']
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            if proc.info['name'] in target_processes:
                proc.kill()
                logging.info(f"Successfully killed orphaned process: {proc.info['name']} (PID: {proc.info['pid']})")
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass

if __name__ == '__main__':
    # Start Backend
    t = threading.Thread(target=start_server)
    t.daemon = True
    t.start()
    
    wait_for_server()
    
    # Setup Bridge
    api = Api()
    
    # Create Window
    native_window = webview.create_window(
        'BigFix Studio', 
        'http://127.0.0.1:8000', 
        width=1400, 
        height=850,
        min_size=(1024, 768),
        background_color='#1a1d24',
        js_api=api
    )
    
    # Start Window
    webview.start()
    
    # Cleanup on exit
    kill_zombie_processes()
    logging.info("=== BigFix Studio Shutting Down ===")
    os._exit(0)