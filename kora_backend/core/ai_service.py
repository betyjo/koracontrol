import joblib
import numpy as np
import os

# Load the trained model
MODEL_PATH = os.path.join(os.path.dirname(__file__), '../../kora_ai/anomaly_model.pkl')

def run_anomaly_detection(tag_data):
    """
    Real AI Detection using Isolation Forest
    """
    try:
        model = joblib.load(MODEL_PATH)
        
        # Get the latest value from the logs
        latest_val = tag_data[0].value if tag_data else 0
        
        # AI Prediction: -1 is Anomaly, 1 is Normal
        prediction = model.predict([[latest_val]])[0]
        
        if prediction == -1:
            return True, 0.92, f"AI detected statistical outlier. Value {latest_val} is outside learned normal range."
        
        return False, 0.98, "Statistical pattern is normal."
    except Exception as e:
        # Fallback to simple threshold if AI fails
        return False, 0.0, f"AI Model Error: {str(e)}"

import google.generativeai as genai

# Configure Gemini with the user's API key
genai.configure(api_key="AIzaSyBx5AcXvKUSbfzp02mcGq9W7IV4W7HLnd8")

def get_ai_chat_response(user_message):
    try:
        # Define the system instructions via the model initialization
        model = genai.GenerativeModel(
            model_name="gemini-flash-latest",
            system_instruction=(
                "You are the Kora Control AI Assistant. You are an expert in industrial "
                "automation, energy efficiency, and SCADA systems. Answer the user's "
                "questions professionally. If they ask about energy, give specific "
                "industrial advice like optimizing motor usage or checking for air leaks."
            )
        )
        
        response = model.generate_content(user_message)
        return response.text
    except Exception as e:
        return f"I'm having trouble connecting to my brain right now. Error: {str(e)}"
