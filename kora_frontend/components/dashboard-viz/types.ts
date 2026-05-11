export type VizStatusLevel = 'normal' | 'warning' | 'alarm';

export interface VizLivePanel {
  id: number;
  widget_type: 'tank' | 'gauge' | 'status' | 'trend';
  title: string;
  tag_id: number;
  tag_name: string;
  unit: string;
  scale_min: number;
  scale_max: number;
  value: number | null;
  timestamp: string | null;
  fill_ratio: number | null;
  needle_degrees: number | null;
  status_level: VizStatusLevel;
  series: { t: string; value: number }[];
}
