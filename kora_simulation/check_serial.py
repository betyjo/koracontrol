"""
Quick diagnostic to check if Proteus is sending data through the serial port.
Run this BEFORE starting the bridge to verify the serial link.

Usage:
    python check_serial.py
"""
import sys
import time

try:
    import serial
except ImportError:
    print("pyserial not installed. Run: pip install pyserial")
    sys.exit(1)

SERIAL_PORT = 'COM8'   # Listen on COM8 (com0com mirrors COM7->COM8)
BAUD_RATE = 9600
LISTEN_SECONDS = 10

print(f"=== Kora Serial Diagnostic ===")
print(f"Checking {SERIAL_PORT} at {BAUD_RATE} baud...")
print(f"Listening for {LISTEN_SECONDS} seconds...\n")

try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    print(f"[OK] Opened {SERIAL_PORT} successfully.\n")
except Exception as e:
    print(f"[FAIL] Cannot open {SERIAL_PORT}: {e}")
    print(f"\nTroubleshooting:")
    print(f"  1. Is com0com running and configured?")
    print(f"  2. Is another program using {SERIAL_PORT}?")
    print(f"  3. Try: python serial_mqtt_bridge.py --sim  (simulation mode)")
    sys.exit(1)

lines_received = 0
start = time.time()

try:
    while (time.time() - start) < LISTEN_SECONDS:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8', errors='replace').strip()
            if line:
                lines_received += 1
                print(f"  [{lines_received}] {line}")
        time.sleep(0.05)
except KeyboardInterrupt:
    pass
finally:
    ser.close()

elapsed = time.time() - start
print(f"\n=== Results ===")
print(f"Listened for {elapsed:.1f} seconds")
print(f"Lines received: {lines_received}")

if lines_received > 0:
    print(f"\n[PASS] Proteus is sending data through {SERIAL_PORT}!")
    print(f"You can now run: python serial_mqtt_bridge.py")
else:
    print(f"\n[FAIL] No data received from Proteus on {SERIAL_PORT}.")
    print(f"\nChecklist:")
    print(f"  1. Is Proteus simulation RUNNING (play button clicked)?")
    print(f"  2. In Proteus, double-click the COMPIM component:")
    print(f"     - Physical port: {SERIAL_PORT}")
    print(f"     - Baud rate: {BAUD_RATE}")
    print(f"     - Data bits: 8, Parity: None, Stop bits: 1")
    print(f"  3. Is the microcontroller loaded with the hex file?")
    print(f"     - Compile esp32_water_control.ino in Arduino IDE")
    print(f"     - Load the .hex into the MCU in Proteus")
    print(f"  4. Check Proteus virtual terminal shows JSON output")
    print(f"\nAlternatively, use simulation mode:")
    print(f"  python serial_mqtt_bridge.py --sim")
