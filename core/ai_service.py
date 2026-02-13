import random

def run_anomaly_detection(tag_data):
    """
    This is where Team 5 will integrate their model.
    Input: Historical tag data
    Output: (is_anomaly, confidence, explanation)
    """
    # SIMULATING AI LOGIC:
    # If the latest value is > 100, we flag it as an anomaly
    latest_value = tag_data[0].value if tag_data else 0
    
    if latest_value > 100:
        return True, 0.95, f"Value {latest_value} exceeds safety threshold of 100."
    
    return False, 0.99, "Normal operation detected."

def get_ai_chat_response(message):
    """
    Simulates an AI assistant for the Customer Portal.
    """
    responses = [
        "Your average consumption is 12% lower than last month.",
        "I detected a minor pressure fluctuation at 2:00 AM, but it resolved itself.",
        "You have one unpaid bill from October.",
        "The system is currently running at 94% efficiency."
    ]
    return random.choice(responses)
