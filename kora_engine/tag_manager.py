class TagManager:
    def __init__(self):
        # The Value Cache (In-Memory)
        self.cache = {
            "L01": {"name": "Tank_Level", "value": 0.0, "unit": "%", "limit": 90.0},
            "P01": {"name": "Pump_Status", "value": 0.0, "unit": "State", "limit": 1.0},
            "F01": {"name": "Flow_Rate", "value": 0.0, "unit": "L/min", "limit": 80.0},
            "Pr01": {"name": "System_Pressure", "value": 0.0, "unit": "Bar", "limit": 8.0},
        }

    def update_tag(self, tag_id, new_value):
        if tag_id in self.cache:
            self.cache[tag_id]["value"] = new_value

    def get_all_tags(self):
        return self.cache
