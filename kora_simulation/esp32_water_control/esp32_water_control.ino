/*
 * KORA SCADA - Advanced Water Control System
 * Option A: Firmware-Simulated Cascade & Health Monitoring
 * 
 * Target Microcontroller: ESP32-WROOM (Proteus Simulation)
 * 
 * Verified Physical Pin Connections:
 * - COMPIM (Serial): TX0 and RX0 (D9 acts as RX)
 * - Ultrasonic Sensor: TRIG -> D7, ECHO -> D8
 * - LCD Display (16x2): RS -> D0, E -> D1, D4 -> D2, D5 -> D3, D6 -> D4, D7 -> D5
 * - Pump Relay: D6
 * - Flow Potentiometer (RV1): D6
 * - Pressure Potentiometer (RV2): D5
 * 
 * Simulated Parameters (Option A):
 * - Tank B and Tank C levels (based on Pump A and simulated transfer pumps)
 * - Pump A/B/C temperatures and pump vibration
 * - Secondary valves status (Inlet, Outlet, Bypass)
 */

#include <LiquidCrystal.h>

// --- ESP32 Proteus Pin Mapping (matched to the Proteus schematic) ---
const int LCD_RS_PIN   = 0;   // D0  → LCD RS
const int LCD_EN_PIN   = 1;   // D1  → LCD E
const int LCD_D4_PIN   = 2;   // D2  → LCD D4
const int LCD_D5_PIN   = 3;   // D3  → LCD D5
const int LCD_D6_PIN   = 4;   // D4  → LCD D6
const int LCD_D7_PIN   = 5;   // D5  → LCD D7

const int PUMP_RELAY_PIN   = 6;   // D6  → Pump Relay (moved from D4)
const int POT_PRESS_PIN    = 7;   // D7  → Pressure Potentiometer
const int POT_FLOW_PIN     = 8;   // D8  → Flow Potentiometer
const int TRIG_PIN         = 9;   // D9  → Ultrasonic Trigger
const int ECHO_PIN         = 10;  // D10 → Ultrasonic Echo (if available)

LiquidCrystal lcd(LCD_RS_PIN, LCD_EN_PIN,
                  LCD_D4_PIN, LCD_D5_PIN,
                  LCD_D6_PIN, LCD_D7_PIN);

// --- PID Control Parameters ---
float pid_setpoint = 50.0;      // Target tank A level (%)
float pid_kp = 2.0;             // Proportional gain
float pid_ki = 0.5;             // Integral gain
float pid_kd = 1.0;             // Derivative gain
float pid_integral = 0.0;
float pid_prev_error = 0.0;
unsigned long pid_last_time = 0;

// --- Physical Readings ---
int level_a = 0;
int flow_rate = 0;
float pressure_val = 0.0;

// --- Simulated Cascade System State (Option A) ---
float level_b = 35.0;            // Tank B level (%)
float level_c = 20.0;            // Tank C level (%)
bool pump_a_on = false;          // Pump A status (Physical D4)
bool pump_b_on = false;          // Simulated Pump B status
bool pump_c_on = false;          // Simulated Pump C status

float temp_a = 24.0;             // Pump A Temperature (°C)
float temp_b = 24.0;             // Pump B Temperature (°C)
float temp_c = 24.0;             // Pump C Temperature (°C)
float vibration_val = 0.05;      // Pump A Vibration (G)

bool inlet_valve_open = false;
bool outlet_valve_open = false;
bool bypass_valve_open = false;

unsigned long last_update = 0;
const unsigned long UPDATE_INTERVAL = 1000; // Update SCADA every 1 second

void setup() {
  // Serial output (COMPIM)
  Serial.begin(9600);
  
  // Ultrasonic Pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  // Actuators
  pinMode(PUMP_RELAY_PIN, OUTPUT);
  digitalWrite(PUMP_RELAY_PIN, LOW);
  
  // Initialize LCD
  lcd.begin(16, 2);
  delay(50);                     // give LCD time to settle
  Serial.println("LCD initialized");
  lcd.clear();
  lcd.print("KORA SCADA A-SIM");
  lcd.setCursor(0, 1);
  lcd.print("ESP32 WROOM V2");
  delay(2000);
  lcd.clear();
}

void loop() {
  unsigned long now = millis();
  
  if (now - last_update >= UPDATE_INTERVAL) {
    last_update = now;
    
    // 1. Read Physical Sensors from Proteus
    level_a = readLevelA();
    flow_rate = map(analogRead(POT_FLOW_PIN), 0, 4095, 0, 100);       // ESP32 ADC is 12-bit (0-4095)
    pressure_val = map(analogRead(POT_PRESS_PIN), 0, 4095, 0, 100) / 10.0; // 0-10.0 bar
    
    // 2. Run PID Control for Tank A
    float pid_output = runPID(level_a);
    applyPIDOutput(pid_output, level_a);
    
    // 3. Run Option A Cascade Simulation Model
    updateCascadeSimulation();
    
    // 4. Update the 16x2 LCD (cycling display pages)
    updateLCDDisplay();
    
    // 5. Send Telemetry to Serial Bridge in JSON
    sendTelemetry(pid_output);
  }
}

// --- Read Physical Tank A Level ---
int readLevelA() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  
  if (duration == 0) return 0;
  
  // Convert duration to distance in cm using HC‑SR04 factor (58 µs per cm)
  float distance_cm = duration / 58.0;
  // Map distance (5 cm = full, 80 cm = empty) to level %
  int level = map((int)distance_cm, 5, 80, 100, 0);
  return constrain(level, 0, 100);
}

// --- PID Control Loop ---
float runPID(int current_level) {
  unsigned long now = millis();
  float dt = (now - pid_last_time) / 1000.0;
  pid_last_time = now;
  
  if (dt <= 0 || dt > 10) dt = 1.0;
  
  float error = pid_setpoint - current_level;
  
  // Proportional
  float p_term = pid_kp * error;
  
  // Integral
  pid_integral += error * dt;
  pid_integral = constrain(pid_integral, -100, 100);
  float i_term = pid_ki * pid_integral;
  
  // Derivative
  float derivative = (error - pid_prev_error) / dt;
  float d_term = pid_kd * derivative;
  pid_prev_error = error;
  
  float output = p_term + i_term + d_term;
  return constrain(output, -100, 100);
}

// --- Apply Actuator Commands ---
void applyPIDOutput(float output, int level) {
  // Safety override triggers
  if (level < 10) {
    digitalWrite(PUMP_RELAY_PIN, HIGH);
    pump_a_on = true;
    inlet_valve_open = true;
    outlet_valve_open = false;
  } else if (level > 95) {
    digitalWrite(PUMP_RELAY_PIN, LOW);
    pump_a_on = false;
    inlet_valve_open = false;
    outlet_valve_open = true;
  } else {
    // Standard PID control
    if (output > 15) {
      digitalWrite(PUMP_RELAY_PIN, HIGH);
      pump_a_on = true;
      inlet_valve_open = true;
    } else if (output < -15) {
      digitalWrite(PUMP_RELAY_PIN, LOW);
      pump_a_on = false;
      inlet_valve_open = false;
    }
  }
  
  // High pressure opens bypass valve
  bypass_valve_open = (pressure_val > 8.0);
}

// --- Option A: Cascade & Health Simulation ---
void updateCascadeSimulation() {
  // Tank B logic: Fills when Pump A is on, drains when Pump B is on
  float inflow_b = pump_a_on ? 1.5 : 0.0;
  float outflow_b = pump_b_on ? 1.8 : 0.0;
  level_b += (inflow_b - outflow_b);
  level_b = constrain(level_b, 0.0, 100.0);
  
  // Control Pump B (Simulated)
  if (level_b > 75.0) pump_b_on = true;
  if (level_b < 25.0) pump_b_on = false;

  // Tank C logic: Fills when Pump B is on, drains when Pump C is on
  float inflow_c = pump_b_on ? 1.8 : 0.0;
  float outflow_c = pump_c_on ? 1.2 : 0.0;
  level_c += (inflow_c - outflow_c);
  level_c = constrain(level_c, 0.0, 100.0);

  // Control Pump C (Simulated)
  if (level_c > 70.0) pump_c_on = true;
  if (level_c < 20.0) pump_c_on = false;

  // Equipment Temperature Simulations
  if (pump_a_on) temp_a = temp_a + 0.3 - (temp_a - 24.0) * 0.02; // max ~39C
  else temp_a = temp_a - 0.2;
  temp_a = max(24.0, temp_a);

  if (pump_b_on) temp_b = temp_b + 0.25 - (temp_b - 24.0) * 0.02;
  else temp_b = temp_b - 0.2;
  temp_b = max(24.0, temp_b);

  if (pump_c_on) temp_c = temp_c + 0.2 - (temp_c - 24.0) * 0.02;
  else temp_c = temp_c - 0.2;
  temp_c = max(24.0, temp_c);

  // Pump A Vibration Simulation (Add motor noise)
  if (pump_a_on) {
    vibration_val = 1.1 + random(-20, 20) / 100.0; // 0.9 to 1.3 G
  } else {
    vibration_val = 0.05 + random(0, 5) / 100.0; // ~0.05 G
  }
}

// --- Update LCD Display ---
void updateLCDDisplay() {
  static int page = 0;
  lcd.clear();
  lcd.setCursor(0, 0);
  
  switch (page) {
    case 0:
      // Greeting page
      lcd.print("KORA SCADA A-SIM");
      lcd.setCursor(0, 1);
      lcd.print("ESP32 WROOM V2");
      break;
    case 1:
      // Tank Levels
      lcd.print("TA:"); lcd.print(level_a); lcd.print("% TB:"); lcd.print((int)level_b); lcd.print("%");
      lcd.setCursor(0, 1);
      lcd.print("TC:"); lcd.print((int)level_c); lcd.print("% F:"); lcd.print(flow_rate);
      break;
    case 2:
      // Actuator and Flow Status
      lcd.print("P_A:"); lcd.print(pump_a_on ? "ON " : "OFF");
      lcd.print(" P_B:"); lcd.print(pump_b_on ? "ON " : "OFF");
      lcd.setCursor(0, 1);
      lcd.print("P_C:"); lcd.print(pump_c_on ? "ON " : "OFF");
      lcd.print(" Pr:"); lcd.print(pressure_val, 1); lcd.print("b");
      break;
    case 3:
      // Temperature and Vibration
      lcd.print("TmpA:"); lcd.print(temp_a, 1); lcd.print("C");
      lcd.setCursor(0, 1);
      lcd.print("Vib:"); lcd.print(vibration_val, 2); lcd.print("G");
      break;
  }
  // Advance to next page for next call
  page = (page + 1) % 4;
}

// --- Send Telemetry to Serial ---
void sendTelemetry(float pid_output) {
  Serial.print("{\"L_A\":"); Serial.print(level_a);
  Serial.print(",\"L_B\":"); Serial.print((int)level_b);
  Serial.print(",\"L_C\":"); Serial.print((int)level_c);
  Serial.print(",\"P_A\":"); Serial.print(pump_a_on ? 1 : 0);
  Serial.print(",\"P_B\":"); Serial.print(pump_b_on ? 1 : 0);
  Serial.print(",\"P_C\":"); Serial.print(pump_c_on ? 1 : 0);
  Serial.print(",\"T_A\":"); Serial.print(temp_a, 1);
  Serial.print(",\"T_B\":"); Serial.print(temp_b, 1);
  Serial.print(",\"T_C\":"); Serial.print(temp_c, 1);
  Serial.print(",\"F\":"); Serial.print(flow_rate);
  Serial.print(",\"Pr\":"); Serial.print(pressure_val, 1);
  Serial.print(",\"Vib\":"); Serial.print(vibration_val, 2);
  Serial.print(",\"VFD\":"); Serial.print(pump_a_on ? 100 : 0);
  Serial.print(",\"IV\":"); Serial.print(inlet_valve_open ? 1 : 0);
  Serial.print(",\"OV\":"); Serial.print(outlet_valve_open ? 1 : 0);
  Serial.print(",\"BV\":"); Serial.print(bypass_valve_open ? 1 : 0);
  Serial.print(",\"PID\":"); Serial.print(pid_output, 1);
  Serial.println("}");
}
