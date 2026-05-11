import os
import time
import requests
from drivers import MockDriver
from tag_manager import TagManager
from alarm_manager import AlarmManager

ENGINE_DIR = os.path.dirname(__file__)
ENV_PATH = os.path.join(ENGINE_DIR, ".env")
ENV_EXAMPLE_PATH = os.path.join(ENGINE_DIR, ".env.example")


def _load_local_env():
    # Prefer .env; fallback to .env.example for quick local setups.
    candidate_paths = [ENV_PATH, ENV_EXAMPLE_PATH]

    try:
        from dotenv import load_dotenv

        for path in candidate_paths:
            if os.path.exists(path):
                load_dotenv(path, override=False)
                break
        return
    except ImportError:
        # Fallback parser when python-dotenv is not installed.
        pass

    for path in candidate_paths:
        if not os.path.exists(path):
            continue

        try:
            with open(path, "r", encoding="utf-8") as env_file:
                for line in env_file:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip().strip("'").strip('"')
                    if key and key not in os.environ:
                        os.environ[key] = value
            break
        except OSError:
            continue


_load_local_env()

# Configuration for your Django Backend
API_URL = "http://127.0.0.1:8000/api/logs/"
AUTH_LOGIN_URL = "http://127.0.0.1:8000/api/auth/login/"

# Prefer environment variables so tokens can rotate without code edits.
JWT_TOKEN = os.getenv("KORA_ENGINE_TOKEN", "").strip()
ENGINE_USERNAME = os.getenv("KORA_ENGINE_USERNAME", "").strip()
ENGINE_PASSWORD = os.getenv("KORA_ENGINE_PASSWORD", "").strip()

class KoraEngine:
    def __init__(self):
        self.driver = MockDriver()
        self.tags = TagManager()
        self.alarms = AlarmManager()
        self.is_running = False
        self.jwt_token = JWT_TOKEN
        self.tag_id_cache = {}

    def start(self):
        self.driver.connect()
        self.is_running = True
        print("🚀 Kora Industrial Engine Started...")
        
        try:
            while self.is_running:
                # 1. READ: Get data from PLC
                for tag_id, info in self.tags.get_all_tags().items():
                    tag_name = info['name']
                    new_val = self.driver.read_tag(tag_id)
                    self.tags.update_tag(tag_id, new_val)
                    
                    # 2. CHECK: Check for Alarms
                    self.alarms.check_thresholds(tag_id, self.tags.cache[tag_id])

                    # 3. LOG: Send to PostgreSQL via Django API
                    self.log_to_backend(tag_name, new_val)

                print("--- Scan Cycle Complete ---")
                time.sleep(2) # 2-second scan cycle
        except KeyboardInterrupt:
            self.stop()

    def log_to_backend(self, tag_name, value):
        if not self.jwt_token and not (ENGINE_USERNAME and ENGINE_PASSWORD):
            print("❌ Missing auth config. Set KORA_ENGINE_TOKEN or (KORA_ENGINE_USERNAME + KORA_ENGINE_PASSWORD).")
            return

        try:
            # 1. Look up the tag ID by name (cached after first successful read)
            tag_id = self.tag_id_cache.get(tag_name)
            if tag_id is None:
                tags = self._fetch_tags_with_reauth()
                if tags is None:
                    return

                for t in tags:
                    self.tag_id_cache[t["name"]] = t["id"]
                tag_id = self.tag_id_cache.get(tag_name)

            if tag_id is None:
                print(f"❌ Error: Tag '{tag_name}' not found in Database. Create it in Admin first!")
                return

            # 2. Log the data using the dynamic ID
            payload = {"tag": tag_id, "value": value}
            headers = {"Authorization": f"Bearer {self.jwt_token}"} if self.jwt_token else {}
            response = requests.post(API_URL, json=payload, headers=headers)

            if response.status_code == 401 and self._login():
                headers = {"Authorization": f"Bearer {self.jwt_token}"}
                response = requests.post(API_URL, json=payload, headers=headers)

            if response.status_code == 201:
                print(f"✅ Data Logged: {tag_name} (ID:{tag_id}) = {value}")
            else:
                print(f"❌ Failed to log {tag_name}: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"❌ Connection Error in engine: {e}")

    def _login(self):
        if not (ENGINE_USERNAME and ENGINE_PASSWORD):
            return False

        try:
            res = requests.post(
                AUTH_LOGIN_URL,
                json={"username": ENGINE_USERNAME, "password": ENGINE_PASSWORD},
                timeout=10,
            )
            if res.status_code != 200:
                print(f"❌ Login failed for engine user: {res.status_code}")
                return False

            self.jwt_token = res.json().get("access", "")
            if not self.jwt_token:
                print("❌ Login response did not include access token.")
                return False

            print("🔐 Engine token refreshed via login.")
            return True
        except Exception as e:
            print(f"❌ Login request failed: {e}")
            return False

    def _fetch_tags_with_reauth(self):
        headers = {"Authorization": f"Bearer {self.jwt_token}"} if self.jwt_token else {}
        tag_res = requests.get("http://127.0.0.1:8000/api/tags/", headers=headers)

        if tag_res.status_code == 401 and self._login():
            headers = {"Authorization": f"Bearer {self.jwt_token}"}
            tag_res = requests.get("http://127.0.0.1:8000/api/tags/", headers=headers)

        if tag_res.status_code != 200:
            print(f"❌ Failed to fetch tags: {tag_res.status_code}")
            return None

        return tag_res.json()

    def stop(self):
        self.is_running = False
        print("Engine Stopped.")

if __name__ == "__main__":
    engine = KoraEngine()
    engine.start()
