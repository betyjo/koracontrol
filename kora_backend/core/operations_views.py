"""
Operational SCADA endpoints: historian/trends, plant layout, shift journal, notifications.
"""

import csv
import io
from datetime import timedelta

from django.db.models import Avg
from django.db.models.functions import TruncMinute
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.shortcuts import get_object_or_404

from rest_framework import generics, permissions, status
from rest_framework.response import Response

from .models import (
    AlarmEvent,
    Complaint,
    InAppNotification,
    NotificationSubscription,
    OperatorJournalEntry,
    PlantArea,
    Tag,
    TagLog,
    TrendAnnotation,
    User,
)
from .serializers import (
    InAppNotificationSerializer,
    NotificationSubscriptionSerializer,
    OperatorJournalEntrySerializer,
    TrendAnnotationSerializer,
)

OPEN_ALARM_STATES = ['active', 'acknowledged', 'shelved']
MAX_RAW_POINTS_PER_TAG = 4000


def _parse_dt(val: str):
    dt = parse_datetime(val)
    if dt is None:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def build_history_payload(tag_ids_str: str, start_s: str, end_s: str, mode: str):
    """Returns (error_response_or_None, data_dict_or_None)."""
    if not tag_ids_str or not start_s or not end_s:
        return Response({'detail': 'tag_ids, start, and end are required (ISO 8601).'}, status=400), None

    try:
        tag_ids = [int(x.strip()) for x in tag_ids_str.split(',') if x.strip()]
    except ValueError:
        return Response({'detail': 'tag_ids must be comma-separated integers.'}, status=400), None

    if not tag_ids:
        return Response({'detail': 'At least one tag_id required.'}, status=400), None

    start = _parse_dt(start_s)
    end = _parse_dt(end_s)
    if not start or not end or end <= start:
        return Response({'detail': 'Invalid start/end window.'}, status=400), None

    tag_meta = {t.id: {'name': t.name, 'unit': t.unit or ''} for t in Tag.objects.filter(id__in=tag_ids)}

    if mode == 'avg_minute':
        series = {}
        for tid in tag_ids:
            if tid not in tag_meta:
                continue
            rows = (
                TagLog.objects.filter(tag_id=tid, timestamp__gte=start, timestamp__lte=end)
                .annotate(bucket=TruncMinute('timestamp'))
                .values('bucket')
                .annotate(v=Avg('value'))
                .order_by('bucket')
            )
            series[str(tid)] = [{'t': r['bucket'].isoformat(), 'v': round(float(r['v']), 6)} for r in rows]
    else:
        series = {}
        for tid in tag_ids:
            if tid not in tag_meta:
                continue
            qs = (
                TagLog.objects.filter(tag_id=tid, timestamp__gte=start, timestamp__lte=end)
                .order_by('timestamp')
                .values_list('timestamp', 'value')
            )
            pts = [{'t': ts.isoformat(), 'v': float(val)} for ts, val in qs]
            if len(pts) > MAX_RAW_POINTS_PER_TAG:
                step = max(1, len(pts) // MAX_RAW_POINTS_PER_TAG)
                pts = pts[::step]
            series[str(tid)] = pts

    ann = TrendAnnotation.objects.filter(tag_id__in=tag_ids, at__gte=start, at__lte=end).order_by('at')
    annotations = TrendAnnotationSerializer(ann, many=True).data

    data = {
        'mode': mode,
        'start': start.isoformat(),
        'end': end.isoformat(),
        'tags': tag_meta,
        'series': series,
        'annotations': annotations,
    }
    return None, data


class HistoryQueryView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        err, data = build_history_payload(
            request.query_params.get('tag_ids', ''),
            request.query_params.get('start', ''),
            request.query_params.get('end', ''),
            request.query_params.get('mode', 'raw'),
        )
        if err:
            return err
        return Response(data)


class HistoryExportCsvView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        err, data = build_history_payload(
            request.query_params.get('tag_ids', ''),
            request.query_params.get('start', ''),
            request.query_params.get('end', ''),
            request.query_params.get('mode', request.query_params.get('mode', 'raw')),
        )
        if err:
            return err

        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(['tag_id', 'tag_name', 'timestamp', 'value'])
        tags = data['tags']
        for tid_str, pts in data['series'].items():
            meta = tags.get(int(tid_str), {})
            name = meta.get('name', tid_str)
            for p in pts:
                w.writerow([tid_str, name, p.get('t'), p.get('v')])
        response = HttpResponse(buf.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="trend_export.csv"'
        return response


class TrendAnnotationListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TrendAnnotationSerializer

    def get_queryset(self):
        qs = TrendAnnotation.objects.select_related('tag', 'created_by').order_by('-at')
        tag_id = self.request.query_params.get('tag_id')
        start_s = self.request.query_params.get('start')
        end_s = self.request.query_params.get('end')
        if tag_id:
            qs = qs.filter(tag_id=tag_id)
        start = _parse_dt(start_s) if start_s else None
        end = _parse_dt(end_s) if end_s else None
        if start:
            qs = qs.filter(at__gte=start)
        if end:
            qs = qs.filter(at__lte=end)
        return qs

    def perform_create(self, serializer):
        if self.request.user.role not in ['admin', 'operator']:
            raise permissions.PermissionDenied('Only operators/admins can add annotations.')
        serializer.save(created_by=self.request.user)


class PlantOverviewView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        stale_cutoff = timezone.now() - timedelta(minutes=15)
        areas_out = []

        for area in PlantArea.objects.prefetch_related('equipment', 'equipment__primary_tag').order_by(
            'sort_order', 'code'
        ):
            equipment_out = []
            tag_ids_area = []
            for eq in area.equipment.all():
                tid = eq.primary_tag_id
                if tid:
                    tag_ids_area.append(tid)
                has_alarm = False
                last_seen = None
                offline = True
                if tid:
                    has_alarm = AlarmEvent.objects.filter(
                        rule__tag_id=tid,
                        state__in=OPEN_ALARM_STATES,
                    ).exists()
                    row = TagLog.objects.filter(tag_id=tid).only('timestamp').first()
                    if row:
                        last_seen = row.timestamp.isoformat()
                        offline = row.timestamp < stale_cutoff
                    else:
                        offline = True

                equipment_out.append(
                    {
                        'id': eq.id,
                        'code': eq.code,
                        'name': eq.name,
                        'primary_tag_id': tid,
                        'primary_tag_name': eq.primary_tag.name if eq.primary_tag_id else None,
                        'map_rect': eq.map_rect or {},
                        'has_open_alarm': has_alarm,
                        'last_seen': last_seen,
                        'offline': offline,
                    }
                )

            alarm_area = 0
            if tag_ids_area:
                alarm_area = AlarmEvent.objects.filter(
                    rule__tag_id__in=tag_ids_area,
                    state__in=OPEN_ALARM_STATES,
                ).count()

            areas_out.append(
                {
                    'id': area.id,
                    'code': area.code,
                    'name': area.name,
                    'sort_order': area.sort_order,
                    'layout': area.layout or {},
                    'open_alarm_count': alarm_area,
                    'equipment': equipment_out,
                }
            )

        return Response({'areas': areas_out})


class OperatorJournalListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OperatorJournalEntrySerializer

    def get_queryset(self):
        qs = OperatorJournalEntry.objects.select_related('author').order_by('-occurred_at')
        start_s = self.request.query_params.get('start')
        end_s = self.request.query_params.get('end')
        q = self.request.query_params.get('q', '').strip()
        start = _parse_dt(start_s) if start_s else None
        end = _parse_dt(end_s) if end_s else None
        if start:
            qs = qs.filter(occurred_at__gte=start)
        if end:
            qs = qs.filter(occurred_at__lte=end)
        if q:
            from django.db.models import Q

            qs = qs.filter(Q(title__icontains=q) | Q(body__icontains=q))
        return qs

    def perform_create(self, serializer):
        if self.request.user.role not in ['admin', 'operator']:
            raise permissions.PermissionDenied('Only operators/admins can write journal entries.')
        serializer.save(author=self.request.user)


class InAppNotificationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = InAppNotificationSerializer

    def get_queryset(self):
        return InAppNotification.objects.filter(user=self.request.user)


class InAppNotificationMarkReadView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        n = get_object_or_404(InAppNotification, pk=pk, user=request.user)
        n.read_at = timezone.now()
        n.save(update_fields=['read_at'])
        return Response(InAppNotificationSerializer(n).data)


class InAppNotificationMarkAllReadView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        updated = InAppNotification.objects.filter(user=request.user, read_at__isnull=True).update(read_at=now)
        return Response({'marked_read': updated})


class NotificationSubscriptionListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSubscriptionSerializer

    def get_queryset(self):
        return NotificationSubscription.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NotificationSubscriptionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSubscriptionSerializer

    def get_queryset(self):
        return NotificationSubscription.objects.filter(user=self.request.user)


class EvaluateComplaintSlaView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role not in ['admin', 'operator']:
            return Response(status=status.HTTP_403_FORBIDDEN)

        hours = int(request.query_params.get('hours', 24))
        threshold = timezone.now() - timedelta(hours=hours)
        complaints = list(
            Complaint.objects.filter(
                status='pending',
                priority='high',
                created_at__lt=threshold,
                sla_notification_sent_at__isnull=True,
            )
        )

        recipients = list(User.objects.filter(role__in=['admin', 'operator'], is_active=True))
        notifications_created = 0
        for complaint in complaints:
            title = f'SLA risk: complaint #{complaint.id}'
            body = f'"{complaint.subject}" pending over {hours}h.'
            payload = {'complaint_id': complaint.id}
            for u in recipients:
                InAppNotification.objects.create(
                    user=u,
                    category=InAppNotification.CATEGORY_COMPLAINT_SLA,
                    title=title,
                    body=body,
                    payload=payload,
                )
                notifications_created += 1
            complaint.sla_notification_sent_at = timezone.now()
            complaint.save(update_fields=['sla_notification_sent_at'])

        return Response(
            {'complaints_flagged': len(complaints), 'notifications_created': notifications_created}
        )
