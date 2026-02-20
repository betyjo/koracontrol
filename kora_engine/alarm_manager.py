class AlarmManager:
    def check_thresholds(self, tag_id, tag_data):
        value = tag_data["value"]
        limit = tag_data["limit"]
        
        if value > limit:
            print(f"⚠️ ALARM TRIGGERED: {tag_data['name']} is at {value}{tag_data['unit']} (Limit: {limit})")
            return True
        return False
