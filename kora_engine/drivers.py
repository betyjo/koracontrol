from abc import ABC, abstractmethod
import random

class ProtocolAdapter(ABC):
    @abstractmethod
    def connect(self):
        pass

    @abstractmethod
    def read_tag(self, address):
        pass

    @abstractmethod
    def write_tag(self, address, value):
        pass

# --- Implementation: Mock Driver (For testing without a real PLC) ---
class MockDriver(ProtocolAdapter):
    def connect(self):
        print("Successfully connected to Virtual PLC.")
        return True

    def read_tag(self, address):
        # Simulates a PLC returning a random value
        return round(random.uniform(20.0, 120.0), 2)

    def write_tag(self, address, value):
        print(f"Writing {value} to address {address}")
        return True
