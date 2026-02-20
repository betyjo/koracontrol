import time
import requests
from drivers import MockDriver
from tag_manager import TagManager
from alarm_manager import AlarmManager

# Configuration for your Django Backend
API_URL = "http://127.0.0.1:8000/api/logs/"
# Use the token you got from your Register/Login step
JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzcxNDU5MDE3LCJpYXQiOjE3NzE0NTU0MTcsImp0aSI6IjVkNzU5MjU4Y2MwYjQzNzFhM2E2NDFiZDFiYWI1NzJiIiwidXNlcl9pZCI6IjQifQ.BTjszY3FmOXUcjI4N-_cnx8IN0JrlmSRxS1A6DqxcDQ" 

class KoraEngine:
    def __init__(self):
        self.driver = MockDriver()
        self.tags = TagManager()
        self.alarms = AlarmManager()
        self.is_running = False

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
        headers = {"Authorization": f"Bearer {JWT_TOKEN}"}
        try:
            # 1. Look up the tag ID by name
            tag_res = requests.get("http://127.0.0.1:8000/api/tags/", headers=headers)
            
            if tag_res.status_code != 200:
                print(f"❌ Failed to fetch tags: {tag_res.status_code}")
                return

            tags = tag_res.json()
            tag_id = None
            for t in tags:
                if t['name'] == tag_name:
                    tag_id = t['id']
                    break
            
            if tag_id is None:
                print(f"❌ Error: Tag '{tag_name}' not found in Database. Create it in Admin first!")
                return

            # 2. Log the data using the dynamic ID
            payload = {"tag": tag_id, "value": value}
            response = requests.post(API_URL, json=payload, headers=headers)
            if response.status_code == 201:
                print(f"✅ Data Logged: {tag_name} (ID:{tag_id}) = {value}")
            else:
                print(f"❌ Failed to log {tag_name}: {response.status_code} - {response.text}")
                
        except Exception as e:
            print(f"❌ Connection Error in engine: {e}")

    def stop(self):
        self.is_running = False
        print("Engine Stopped.")

if __name__ == "__main__":
    engine = KoraEngine()
    engine.start()
