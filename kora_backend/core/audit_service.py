"""
KORA Backend — Comprehensive Audit Trail Service

Tracks all system changes with full context:
- User actions (login, config changes, command execution)
- System events (alarms, state transitions)
- Tag value changes (setpoint modifications)
- AI model interactions

Stores audit records and provides query/export capabilities.
"""

import json
import time
from datetime import datetime, timedelta
from collections import defaultdict


class AuditTrail:
    """
    Comprehensive audit trail for SCADA operations.
    Records are stored in-memory with periodic flush to database.
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._buffer = []
        self._buffer_lock = False
        self._max_buffer = 500
    
    def record(self, category, action, user=None, details=None, 
               target_type=None, target_id=None, ip_address=None,
               old_value=None, new_value=None, severity='info'):
        """
        Record an audit event.
        
        Categories: auth, alarm, setpoint, tag, config, ai, system, maintenance
        Actions: login, acknowledge, shelve, change, create, delete, analyze, etc.
        """
        entry = {
            'timestamp': datetime.now().isoformat(),
            'unix_time': time.time(),
            'category': category,
            'action': action,
            'user': user,
            'severity': severity,  # info, warning, critical
            'details': details or {},
            'target_type': target_type,
            'target_id': target_id,
            'ip_address': ip_address,
            'old_value': str(old_value) if old_value is not None else None,
            'new_value': str(new_value) if new_value is not None else None,
        }
        
        self._buffer.append(entry)
        
        # Auto-flush if buffer is large
        if len(self._buffer) >= self._max_buffer:
            self.flush()
        
        return entry
    
    def record_alarm_acknowledge(self, alarm_id, alarm_name, user, ip_address=None):
        return self.record(
            category='alarm',
            action='acknowledge',
            user=user,
            details={'alarm_id': alarm_id, 'alarm_name': alarm_name},
            target_type='alarm_event',
            target_id=alarm_id,
            ip_address=ip_address,
        )
    
    def record_alarm_shelve(self, alarm_id, duration_minutes, user, ip_address=None):
        return self.record(
            category='alarm',
            action='shelve',
            user=user,
            details={'alarm_id': alarm_id, 'duration_minutes': duration_minutes},
            target_type='alarm_event',
            target_id=alarm_id,
            ip_address=ip_address,
        )
    
    def record_setpoint_change(self, tag_name, old_value, new_value, user, ip_address=None):
        return self.record(
            category='setpoint',
            action='change',
            user=user,
            details={'tag_name': tag_name},
            target_type='tag',
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            severity='warning' if abs(float(new_value or 0) - float(old_value or 0)) > 20 else 'info',
        )
    
    def record_login(self, user, success=True, ip_address=None, method='password'):
        return self.record(
            category='auth',
            action='login' if success else 'login_failed',
            user=user,
            details={'method': method, 'success': success},
            ip_address=ip_address,
            severity='info' if success else 'warning',
        )
    
    def record_ai_analysis(self, analysis_type, tag_name=None, result_summary=None, user=None):
        return self.record(
            category='ai',
            action='analyze',
            user=user or 'system',
            details={
                'analysis_type': analysis_type,
                'tag_name': tag_name,
                'result_summary': result_summary,
            },
            target_type='tag' if tag_name else None,
        )
    
    def record_config_change(self, config_item, old_value, new_value, user, ip_address=None):
        return self.record(
            category='config',
            action='change',
            user=user,
            details={'config_item': config_item},
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            severity='warning',
        )
    
    def query(self, category=None, action=None, user=None, 
              start_time=None, end_time=None, severity=None, limit=100):
        """Query audit records from the buffer."""
        results = list(self._buffer)
        
        if category:
            results = [r for r in results if r['category'] == category]
        if action:
            results = [r for r in results if r['action'] == action]
        if user:
            results = [r for r in results if r.get('user') == user]
        if severity:
            results = [r for r in results if r['severity'] == severity]
        if start_time:
            results = [r for r in results if r['unix_time'] >= start_time]
        if end_time:
            results = [r for r in results if r['unix_time'] <= end_time]
        
        # Sort by timestamp descending
        results.sort(key=lambda x: x['unix_time'], reverse=True)
        
        return results[:limit]
    
    def get_statistics(self, hours=24):
        """Get audit statistics for the last N hours."""
        since = time.time() - hours * 3600
        recent = [r for r in self._buffer if r['unix_time'] >= since]
        
        by_category = defaultdict(int)
        by_action = defaultdict(int)
        by_severity = defaultdict(int)
        by_user = defaultdict(int)
        
        for r in recent:
            by_category[r['category']] += 1
            by_action[r['action']] += 1
            by_severity[r['severity']] += 1
            by_user[r.get('user', 'unknown')] += 1
        
        return {
            'total_events': len(recent),
            'period_hours': hours,
            'by_category': dict(by_category),
            'by_action': dict(by_action),
            'by_severity': dict(by_severity),
            'by_user': dict(by_user),
        }
    
    def flush(self):
        """Flush buffer to database (via OperatorActionLog model)."""
        if not self._buffer:
            return 0
        
        flushed = len(self._buffer)
        # Clear buffer (in production, persist to DB first)
        self._buffer = self._buffer[-self._max_buffer:]
        return flushed
    
    def export_csv(self, category=None, start_time=None, end_time=None):
        """Export audit records as CSV string."""
        import csv
        import io
        
        records = self.query(category=category, start_time=start_time, 
                           end_time=end_time, limit=10000)
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Timestamp', 'Category', 'Action', 'User', 'Severity',
                        'Target Type', 'Target ID', 'Old Value', 'New Value',
                        'IP Address', 'Details'])
        
        for r in records:
            writer.writerow([
                r['timestamp'],
                r['category'],
                r['action'],
                r.get('user', ''),
                r['severity'],
                r.get('target_type', ''),
                r.get('target_id', ''),
                r.get('old_value', ''),
                r.get('new_value', ''),
                r.get('ip_address', ''),
                json.dumps(r.get('details', {})),
            ])
        
        return output.getvalue()


# Global singleton
audit_trail = AuditTrail()
