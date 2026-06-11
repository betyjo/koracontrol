"""
KORA Backend — Report Generation Service

Generates comprehensive operational reports:
- Daily/Weekly/Monthly summary reports
- Alarm analysis reports
- Equipment health reports
- Production/performance reports
- Custom date range reports

Output formats: JSON (API), CSV, PDF (future)
"""

import json
import csv
import io
import time
from datetime import datetime, timedelta
from collections import defaultdict, Counter


class ReportGenerator:
    """Generates operational reports from SCADA data."""
    
    @staticmethod
    def generate_daily_summary(date=None):
        """Generate daily operational summary."""
        if date is None:
            date = datetime.now().date()
        elif isinstance(date, str):
            date = datetime.fromisoformat(date).date()
        
        start = datetime.combine(date, datetime.min.time())
        end = start + timedelta(days=1)
        
        from .models import TagLog, AlarmEvent, Tag, AIFinding
        
        # Tag statistics
        tag_stats = {}
        for tag in Tag.objects.all():
            logs = TagLog.objects.filter(tag=tag, timestamp__gte=start, timestamp__lt=end)
            if logs.exists():
                values = [float(l.value) for l in logs]
                tag_stats[tag.name] = {
                    'count': len(values),
                    'mean': round(sum(values) / len(values), 2) if values else 0,
                    'min': round(min(values), 2) if values else 0,
                    'max': round(max(values), 2) if values else 0,
                    'std_dev': round((sum((v - sum(values)/len(values))**2 for v in values) / len(values))**0.5, 2) if values else 0,
                    'unit': tag.unit,
                }
        
        # Alarm statistics
        alarm_events = AlarmEvent.objects.filter(triggered_at__gte=start, triggered_at__lt=end)
        alarm_stats = {
            'total': alarm_events.count(),
            'by_severity': dict(Counter(e.rule.severity for e in alarm_events.select_related('rule') if e.rule)),
            'by_state': dict(Counter(e.state for e in alarm_events)),
            'avg_response_time_min': None,  # Computed if acknowledge data available
        }
        
        # AI findings
        ai_findings = AIFinding.objects.filter(created_at__gte=start, created_at__lt=end)
        ai_stats = {
            'total_analyses': ai_findings.count(),
            'anomalies_detected': ai_findings.filter(finding_type='anomaly').count(),
            'predictions_made': ai_findings.filter(finding_type='prediction').count(),
            'root_causes_found': ai_findings.filter(finding_type='root_cause').count(),
        }
        
        return {
            'report_type': 'daily_summary',
            'date': str(date),
            'period_start': start.isoformat(),
            'period_end': end.isoformat(),
            'generated_at': datetime.now().isoformat(),
            'tag_statistics': tag_stats,
            'alarm_statistics': alarm_stats,
            'ai_statistics': ai_stats,
        }
    
    @staticmethod
    def generate_alarm_report(start_date=None, end_date=None):
        """Generate detailed alarm analysis report."""
        from .models import AlarmEvent, AlarmRule
        
        if end_date is None:
            end_date = datetime.now()
        elif isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date)
        
        if start_date is None:
            start_date = end_date - timedelta(days=7)
        elif isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date)
        
        events = AlarmEvent.objects.filter(
            triggered_at__gte=start_date,
            triggered_at__lte=end_date,
        ).select_related('rule', 'rule__tag').order_by('-triggered_at')
        
        # Alarm frequency analysis
        rule_frequency = Counter()
        tag_frequency = Counter()
        severity_frequency = Counter()
        hour_distribution = Counter()
        day_distribution = Counter()
        
        for event in events:
            if event.rule:
                rule_frequency[event.rule.name] += 1
                tag_frequency[event.rule.tag.name if event.rule.tag else 'unknown'] += 1
                severity_frequency[event.rule.severity] += 1
                if event.triggered_at:
                    hour_distribution[event.triggered_at.hour] += 1
                    day_distribution[event.triggered_at.strftime('%A')] += 1
        
        # Top 10 nuisance alarms
        nuisance_alarms = rule_frequency.most_common(10)
        
        # Calculate MTTR (Mean Time To Respond) if acknowledge data available
        response_times = []
        for event in events:
            if event.acknowledged_at and event.triggered_at:
                rt = (event.acknowledged_at - event.triggered_at).total_seconds() / 60
                response_times.append(rt)
        
        avg_response_time = round(sum(response_times) / len(response_times), 1) if response_times else None
        
        return {
            'report_type': 'alarm_analysis',
            'period_start': start_date.isoformat(),
            'period_end': end_date.isoformat(),
            'generated_at': datetime.now().isoformat(),
            'total_events': events.count(),
            'alarm_frequency_by_rule': dict(rule_frequency.most_common(20)),
            'alarm_frequency_by_tag': dict(tag_frequency.most_common(20)),
            'severity_distribution': dict(severity_frequency),
            'hour_distribution': dict(sorted(hour_distribution.items())),
            'day_distribution': dict(day_distribution),
            'top_nuisance_alarms': [{'rule': r, 'count': c} for r, c in nuisance_alarms],
            'avg_response_time_minutes': avg_response_time,
            'response_time_samples': len(response_times),
        }
    
    @staticmethod
    def generate_equipment_health_report():
        """Generate equipment health report."""
        from .models import PlantEquipment, TagLog
        
        equipment_list = PlantEquipment.objects.select_related('area').all()
        health_report = []
        
        for eq in equipment_list:
            tid = eq.primary_tag_id
            if not tid:
                continue
            
            recent_logs = TagLog.objects.filter(tag_id=tid).order_by('-timestamp')[:500]
            if not recent_logs:
                continue
            
            values = [float(log.value) for log in recent_logs]
            avg = sum(values) / len(values)
            std_dev = (sum((v - avg) ** 2 for v in values) / len(values)) ** 0.5
            
            # Compute uptime (percentage of time with valid readings)
            now = datetime.now()
            day_ago = now - timedelta(days=1)
            recent_count = TagLog.objects.filter(tag_id=tid, timestamp__gte=day_ago).count()
            expected_count = 86400 / 2  # Assuming 2-second intervals
            uptime_pct = min(100, round(recent_count / max(expected_count, 1) * 100, 1))
            
            # Health score
            cv = std_dev / max(abs(avg), 1e-9)
            health_score = 1.0
            if cv > 0.3:
                health_score -= 0.3
            elif cv > 0.15:
                health_score -= 0.15
            
            # Trend
            half = len(values) // 2
            first_avg = sum(values[:half]) / half if half > 0 else avg
            second_avg = sum(values[half:]) / (len(values) - half) if (len(values) - half) > 0 else avg
            drift = abs(second_avg - first_avg) / max(abs(first_avg), 1e-9) * 100
            
            if drift > 20:
                health_score -= 0.25
            
            health_score = max(0, min(100, health_score * 100))
            
            health_report.append({
                'equipment_name': eq.name,
                'area': eq.area.name if eq.area else None,
                'health_score': round(health_score, 1),
                'uptime_percentage': uptime_pct,
                'avg_value': round(avg, 2),
                'std_dev': round(std_dev, 2),
                'cv': round(cv, 3),
                'trend_drift_pct': round(drift, 1),
                'samples': len(values),
                'status': 'healthy' if health_score >= 80 else 'degrading' if health_score >= 60 else 'warning' if health_score >= 40 else 'critical',
            })
        
        health_report.sort(key=lambda x: x['health_score'])
        
        return {
            'report_type': 'equipment_health',
            'generated_at': datetime.now().isoformat(),
            'total_equipment': len(health_report),
            'healthy_count': sum(1 for e in health_report if e['status'] == 'healthy'),
            'degrading_count': sum(1 for e in health_report if e['status'] == 'degrading'),
            'warning_count': sum(1 for e in health_report if e['status'] == 'warning'),
            'critical_count': sum(1 for e in health_report if e['status'] == 'critical'),
            'equipment': health_report,
        }
    
    @staticmethod
    def generate_performance_report(start_date=None, end_date=None):
        """Generate production/performance report."""
        from .models import TagLog, Tag
        
        if end_date is None:
            end_date = datetime.now()
        elif isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date)
        
        if start_date is None:
            start_date = end_date - timedelta(days=30)
        elif isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date)
        
        # Get flow rate tag data for production metrics
        flow_tags = Tag.objects.filter(name__icontains='flow')
        
        total_flow = 0
        flow_data = []
        
        for tag in flow_tags:
            logs = TagLog.objects.filter(
                tag=tag, timestamp__gte=start_date, timestamp__lte=end_date
            ).order_by('timestamp')[:1000]
            
            for log in logs:
                total_flow += float(log.value)
                flow_data.append({
                    'timestamp': log.timestamp.isoformat(),
                    'value': float(log.value),
                    'tag': tag.name,
                })
        
        # Daily aggregation
        daily_production = defaultdict(float)
        for d in flow_data:
            day = d['timestamp'][:10]
            daily_production[day] += d['value']
        
        return {
            'report_type': 'performance',
            'period_start': start_date.isoformat(),
            'period_end': end_date.isoformat(),
            'generated_at': datetime.now().isoformat(),
            'total_flow_volume': round(total_flow, 2),
            'daily_production': dict(sorted(daily_production.items())),
            'avg_daily_flow': round(total_flow / max(len(daily_production), 1), 2),
            'peak_daily_flow': round(max(daily_production.values()) if daily_production else 0, 2),
            'data_points': len(flow_data),
        }
    
    @staticmethod
    def export_to_csv(report_data):
        """Export report data to CSV format."""
        output = io.StringIO()
        writer = csv.writer(output)
        
        report_type = report_data.get('report_type', 'unknown')
        writer.writerow(['Report Type', report_type])
        writer.writerow(['Generated At', report_data.get('generated_at', '')])
        writer.writerow(['Period Start', report_data.get('period_start', '')])
        writer.writerow(['Period End', report_data.get('period_end', '')])
        writer.writerow([])
        
        if report_type == 'daily_summary':
            writer.writerow(['Tag Statistics'])
            writer.writerow(['Tag Name', 'Count', 'Mean', 'Min', 'Max', 'Std Dev', 'Unit'])
            for tag_name, stats in report_data.get('tag_statistics', {}).items():
                writer.writerow([
                    tag_name, stats.get('count', 0), stats.get('mean', 0),
                    stats.get('min', 0), stats.get('max', 0), stats.get('std_dev', 0),
                    stats.get('unit', ''),
                ])
        
        elif report_type == 'equipment_health':
            writer.writerow(['Equipment Health'])
            writer.writerow(['Equipment', 'Area', 'Health Score', 'Status', 'Uptime %', 'Avg Value', 'Std Dev'])
            for eq in report_data.get('equipment', []):
                writer.writerow([
                    eq.get('equipment_name', ''), eq.get('area', ''),
                    eq.get('health_score', 0), eq.get('status', ''),
                    eq.get('uptime_percentage', 0), eq.get('avg_value', 0),
                    eq.get('std_dev', 0),
                ])
        
        return output.getvalue()


# Global singleton
report_generator = ReportGenerator()
