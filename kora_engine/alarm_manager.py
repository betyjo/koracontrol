class AlarmManager:
    def check_thresholds(self, tag_id, tag_data):
        value = tag_data["value"]
        limit = tag_data["limit"]
        
        # Convert value to float if possible, otherwise skip comparison
        try:
            numeric_value = float(value)
        except (ValueError, TypeError):
            # Value is not numeric (e.g., "OFF", "ON"), skip threshold check
            return False
        
        if numeric_value > limit:
            print(f" ALARM TRIGGERED: {tag_data['name']} is at {value}{tag_data['unit']} (Limit: {limit})")
            return True
        return False
