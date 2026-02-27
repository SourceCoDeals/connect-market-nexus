import type { LandingPageDeal } from '@/hooks/useDealLandingPage';

interface MetricBox {
  label: string;
  value: string;
  subtitle: string;
}

function formatCurrency(value: number | null | undefined): string {
  if (!value) return '—';
  if (value >= 1_000_000_000) return `~$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `~$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `~$${(value / 1_000).toFixed(0)}K`;
  return `~$${value.toLocaleString()}`;
}

function buildMetrics(deal: LandingPageDeal): MetricBox[] {
  const metrics: MetricBox[] = [];

  // Metric 1: Revenue
  metrics.push({
    label: 'Annual Revenue',
    value: formatCurrency(deal.revenue),
    subtitle: deal.revenue_metric_subtitle || '',
  });

  // Metric 2: EBITDA
  const ebitdaValue = formatCurrency(deal.ebitda);
  const marginStr = deal.ebitda_margin ? `~${Math.round(deal.ebitda_margin)}% margin` : '';
  metrics.push({
    label: 'EBITDA',
    value: ebitdaValue,
    subtitle: deal.ebitda_metric_subtitle || marginStr,
  });

  // Metric 3
  const m3Label = deal.metric_3_custom_label || deal.custom_metric_label;
  const m3Value = deal.metric_3_custom_value || deal.custom_metric_value;
  const m3Sub = deal.metric_3_custom_subtitle || deal.custom_metric_subtitle;
  if (m3Label && m3Value) {
    metrics.push({ label: m3Label, value: m3Value, subtitle: m3Sub || '' });
  } else if (deal.business_model) {
    metrics.push({
      label: 'Contract Model',
      value: deal.business_model,
      subtitle: deal.customer_types || '',
    });
  }

  // Metric 4
  if (deal.metric_4_custom_label && deal.metric_4_custom_value) {
    metrics.push({
      label: deal.metric_4_custom_label,
      value: deal.metric_4_custom_value,
      subtitle: deal.metric_4_custom_subtitle || '',
    });
  } else if (deal.customer_geography) {
    metrics.push({
      label: 'Market Coverage',
      value: deal.customer_geography,
      subtitle: '',
    });
  }

  return metrics;
}

interface MetricsStripProps {
  deal: LandingPageDeal;
}

export default function MetricsStrip({ deal }: MetricsStripProps) {
  const metrics = buildMetrics(deal);

  if (metrics.length === 0) return null;

  return (
    <section className="pb-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <div key={i} className="bg-[#F7F5F0] rounded-lg px-5 py-4">
            <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-[0.08em] mb-1 font-['Inter',system-ui,sans-serif]">
              {metric.label}
            </p>
            <p className="text-[22px] sm:text-[24px] font-bold text-[#1A1A1A] leading-tight font-['Inter',system-ui,sans-serif]">
              {metric.value}
            </p>
            {metric.subtitle && (
              <p className="text-[13px] text-[#6B7280] mt-0.5 font-['Inter',system-ui,sans-serif]">
                {metric.subtitle}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
