'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ProductDashboardData } from '@/services/spartaco-product-analytics';
import SpartacoFilterBar from './SpartacoFilterBar';
import ProductBreakdownTable from './ProductBreakdownTable';
import TrafficBreakdownTable from './TrafficBreakdownTable';
import ProductTrendChart from './ProductTrendChart';
import { 
  fmtNumber, 
  fmtCurrency, 
  fmtCompact, 
  pctChange 
} from '@/lib/utils';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Mail, 
  MousePointer2,
  Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string;
  delta?: string | null;
  current: number;
  previous: number;
  icon: LucideIcon;
  color: string;
  isNorthStar?: boolean;
}

const KpiCard = ({ title, value, delta, current, previous, icon: Icon, color, isNorthStar }: KpiCardProps) => {
  const isPositive = current > previous;
  const isZero = current === previous;
  
  return (
    <div className={cn(
      "bg-white p-6 rounded-3xl border shadow-sm transition-all hover:shadow-md relative overflow-hidden group",
      isNorthStar ? "border-emerald-200 bg-emerald-50/10" : "border-gray-100"
    )}>
      {isNorthStar && (
        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
          North Star
        </div>
      )}
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-2xl bg-opacity-10", color.replace('text-', 'bg-'))}>
          <Icon className={cn("w-6 h-6", color)} />
        </div>
        {delta && (
          <div className={cn(
            "text-xs font-bold px-2 py-1 rounded-lg",
            isZero ? "bg-gray-100 text-gray-500" : (isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")
          )}>
            {delta}
          </div>
        )}
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-500 mb-1">{title}</h4>
        <p className="text-2xl font-black text-brand-dark tracking-tight">{value}</p>
      </div>
    </div>
  );
};

export default function ProductPerformanceClient({ data }: { data: ProductDashboardData }) {
  const { summary, previousSummary, productRows, previousProductRows, channelGroupRows, sourceMediumRows, timeSeries, timeSeriesGrain } = data;
  
  const adRoas = summary.ad_cost > 0 ? summary.ad_revenue / summary.ad_cost : 0;
  const prevAdRoas = previousSummary.ad_cost > 0 ? previousSummary.ad_revenue / previousSummary.ad_cost : 0;

  const kpis = [
    {
      title: 'Ad Spend',
      value: fmtCurrency(summary.ad_cost),
      delta: pctChange(summary.ad_cost, previousSummary.ad_cost),
      current: summary.ad_cost,
      previous: previousSummary.ad_cost,
      icon: DollarSign,
      color: 'text-indigo-600',
    },
    {
      title: 'Ad Revenue',
      value: fmtCurrency(summary.ad_revenue),
      delta: pctChange(summary.ad_revenue, previousSummary.ad_revenue),
      current: summary.ad_revenue,
      previous: previousSummary.ad_revenue,
      icon: ShoppingCart,
      color: 'text-brand-orange',
    },
    {
      title: 'Ad ROAS',
      value: `${adRoas.toFixed(2)}x`,
      delta: pctChange(adRoas, prevAdRoas),
      current: adRoas,
      previous: prevAdRoas,
      icon: TrendingUp,
      color: 'text-emerald-700',
    },
    {
      title: 'GA4 Sessions',
      value: fmtCompact(summary.ga4_sessions),
      delta: pctChange(summary.ga4_sessions, previousSummary.ga4_sessions),
      current: summary.ga4_sessions,
      previous: previousSummary.ga4_sessions,
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: 'GSC Clicks',
      value: fmtNumber(summary.gsc_clicks),
      delta: pctChange(summary.gsc_clicks, previousSummary.gsc_clicks),
      current: summary.gsc_clicks,
      previous: previousSummary.gsc_clicks,
      icon: MousePointer2,
      color: 'text-orange-600',
    },
    {
      title: 'Email Opens',
      value: fmtNumber(summary.email_opens),
      delta: pctChange(summary.email_opens, previousSummary.email_opens),
      current: summary.email_opens,
      previous: previousSummary.email_opens,
      icon: Mail,
      color: 'text-indigo-700',
    },
    {
      title: 'Social Engagement',
      value: fmtNumber(summary.social_engagement),
      delta: pctChange(summary.social_engagement, previousSummary.social_engagement),
      current: summary.social_engagement,
      previous: previousSummary.social_engagement,
      icon: Share2,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="space-y-10 pb-20">
      <SpartacoFilterBar
        mode="ALL"
        currentTab="products"
        initialParams={data.filterParams}
        options={{ brands: data.filterOptions.brands, products: data.filterOptions.products, channelGroups: data.filterOptions.channelGroups, sourceMediums: data.filterOptions.sourceMediums, channels: [], campaigns: [], focuses: [] }}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      <ProductTrendChart
        data={timeSeries}
        grain={timeSeriesGrain}
        dateRange={`${data.filterParams.start} – ${data.filterParams.end}`}
      />

      <ProductBreakdownTable rows={productRows} previousRows={previousProductRows} />
      <TrafficBreakdownTable channelGroupRows={channelGroupRows} sourceMediumRows={sourceMediumRows} />
    </div>
  );
}
