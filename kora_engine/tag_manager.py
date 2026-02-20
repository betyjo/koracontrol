class TagManager:
    def __init__(self):
        # The Value Cache (In-Memory)
        self.cache = {
            "T01": {"name": "Boiler_Temp", "value": 0.0, "unit": "°C", "limit": 100.0},
            "P01": {"name": "System_Pressure", "value": 0.0, "unit": "Bar", "limit": 80.0},
            "F01": {"name": "Flow_Rate", "value": 0.0, "unit": "L/min", "limit": 50.0},
        }

    def update_tag(self, tag_id, new_value):
        if tag_id in self.cache:
            self.cache[tag_id]["value"] = new_value

    def get_all_tags(self):
        return self.cache
