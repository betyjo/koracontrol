"""
KORA Backend — Real-time Updates Service

Provides Server-Sent Events (SSE) for pushing real-time data to web clients:
- Live tag values
- Alarm state changes
- AI analysis results
- Equipment health updates

Uses Django StreamingHttpResponse for SSE (no Channels required).
"""

import json
import time
import threading
import queue
from collections import defaultdict


class SSEBus:
    """
    In-process pub/sub event bus for Server-Sent Events.
    Each connected client gets a queue; publishers push to all queues.
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.subscribers = {}  # client_id -> queue
        self.channels = defaultdict(set)  # channel_name -> set of client_ids
        self._counter = 0
    
    def subscribe(self, channels=None):
        """Subscribe to event channels. Returns (client_id, queue)."""
        with self._lock:
            self._counter += 1
            client_id = f"client_{self._counter}_{time.time()}"
            q = queue.Queue(maxsize=200)
            self.subscribers[client_id] = q
            
            if channels:
                for ch in channels:
                    self.channels[ch].add(client_id)
            else:
                self.channels['all'].add(client_id)
        
        return client_id, q
    
    def unsubscribe(self, client_id):
        """Remove a subscriber."""
        with self._lock:
            self.subscribers.pop(client_id, None)
            for ch_clients in self.channels.values():
                ch_clients.discard(client_id)
    
    def publish(self, channel, data, event_type=None):
        """Publish data to a channel."""
        event = {
            'event': event_type or channel,
            'data': data,
            'timestamp': time.time(),
        }
        
        with self._lock:
            target_ids = set()
            # Add channel-specific subscribers
            target_ids.update(self.channels.get(channel, set()))
            # Add 'all' channel subscribers
            target_ids.update(self.channels.get('all', set()))
            
            targets = [(cid, self.subscribers[cid]) for cid in target_ids 
                      if cid in self.subscribers]
        
        for cid, q in targets:
            try:
                q.put_nowait(event)
            except queue.Full:
                # Drop oldest message if queue is full
                try:
                    q.get_nowait()
                    q.put_nowait(event)
                except queue.Empty:
                    pass
    
    def publish_tag_update(self, tag_name, value, quality='good'):
        """Publish a tag value update."""
        self.publish('tags', {
            'tag_name': tag_name,
            'value': value,
            'quality': quality,
            'type': 'tag_update',
        }, event_type='tag_update')
    
    def publish_alarm(self, alarm_data):
        """Publish an alarm event."""
        self.publish('alarms', {
            **alarm_data,
            'type': 'alarm_event',
        }, event_type='alarm')
    
    def publish_ai_result(self, ai_data):
        """Publish an AI analysis result."""
        self.publish('ai', {
            **ai_data,
            'type': 'ai_analysis',
        }, event_type='ai_result')
    
    def publish_system_status(self, status_data):
        """Publish a system status update."""
        self.publish('system', {
            **status_data,
            'type': 'system_status',
        }, event_type='system_status')


# Global singleton
sse_bus = SSEBus()


def generate_sse_stream(client_id, event_queue, channels=None):
    """
    Generator that yields SSE-formatted messages from a queue.
    Used with Django StreamingHttpResponse.
    """
    try:
        # Send initial connection event
        yield f"data: {json.dumps({'type': 'connected', 'client_id': client_id, 'channels': channels or ['all']})}\n\n"
        
        while True:
            try:
                event = event_queue.get(timeout=30)
                
                # Format as SSE
                event_type = event.get('event', 'message')
                data = json.dumps(event.get('data', {}))
                
                yield f"event: {event_type}\ndata: {data}\n\n"
                
            except queue.Empty:
                # Send keepalive comment to prevent connection timeout
                yield ": keepalive\n\n"
                
    except GeneratorExit:
        pass
    finally:
        sse_bus.unsubscribe(client_id)
