-- ============================================================
-- Spartaco Product Performance: Server-side aggregation
-- 
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Project: https://supabase.com/dashboard/project/lozgnyxixzfxokllevtb
-- ============================================================

CREATE OR REPLACE FUNCTION product_performance_summary(
  p_start DATE,
  p_end DATE,
  p_brand TEXT DEFAULT NULL,
  p_product TEXT DEFAULT NULL
)
RETURNS TABLE (
  product TEXT,
  brand TEXT,
  -- Ads
  ad_impressions BIGINT,
  ad_clicks BIGINT,
  ad_cost NUMERIC,
  ad_conversions BIGINT,
  ad_purchases BIGINT,
  ad_revenue NUMERIC,
  -- GA4
  ga4_sessions BIGINT,
  ga4_engaged_sessions BIGINT,
  ga4_pageviews BIGINT,
  ga4_total_users BIGINT,
  ga4_purchases BIGINT,
  ga4_total_revenue NUMERIC,
  ga4_add_to_carts BIGINT,
  ga4_checkouts BIGINT,
  -- Email
  email_total_sent BIGINT,
  email_opens BIGINT,
  email_clicks BIGINT,
  -- GSC
  gsc_clicks BIGINT,
  gsc_impressions BIGINT,
  -- Social
  social_impressions BIGINT,
  social_engagement NUMERIC,
  social_interactions BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(m.product, 'Unknown')::TEXT                     AS product,
    COALESCE(m.brand,   'Unknown')::TEXT                     AS brand,
    -- Ads
    COALESCE(SUM(m.ad_impressions),    0)::BIGINT            AS ad_impressions,
    COALESCE(SUM(m.ad_clicks),         0)::BIGINT            AS ad_clicks,
    COALESCE(SUM(m.ad_cost),           0)::NUMERIC           AS ad_cost,
    COALESCE(SUM(m.ad_conversions),    0)::BIGINT            AS ad_conversions,
    COALESCE(SUM(m.ad_purchases),      0)::BIGINT            AS ad_purchases,
    COALESCE(SUM(m.ad_revenue),        0)::NUMERIC           AS ad_revenue,
    -- GA4
    COALESCE(SUM(m.ga4_sessions),         0)::BIGINT         AS ga4_sessions,
    COALESCE(SUM(m.ga4_engaged_sessions), 0)::BIGINT         AS ga4_engaged_sessions,
    COALESCE(SUM(m.ga4_pageviews),        0)::BIGINT         AS ga4_pageviews,
    COALESCE(SUM(m.ga4_total_users),      0)::BIGINT         AS ga4_total_users,
    COALESCE(SUM(m.ga4_purchases),        0)::BIGINT         AS ga4_purchases,
    COALESCE(SUM(m.ga4_total_revenue),    0)::NUMERIC        AS ga4_total_revenue,
    COALESCE(SUM(m.ga4_add_to_carts),     0)::BIGINT         AS ga4_add_to_carts,
    COALESCE(SUM(m.ga4_checkouts),        0)::BIGINT         AS ga4_checkouts,
    -- Email
    COALESCE(SUM(m.email_total_sent), 0)::BIGINT             AS email_total_sent,
    COALESCE(SUM(m.email_opens),      0)::BIGINT             AS email_opens,
    COALESCE(SUM(m.email_clicks),     0)::BIGINT             AS email_clicks,
    -- GSC
    COALESCE(SUM(m.gsc_clicks),       0)::BIGINT             AS gsc_clicks,
    COALESCE(SUM(m.gsc_impressions),  0)::BIGINT             AS gsc_impressions,
    -- Social
    COALESCE(SUM(m.social_impressions),  0)::BIGINT          AS social_impressions,
    COALESCE(SUM(m.social_engagement),   0)::NUMERIC         AS social_engagement,
    COALESCE(SUM(m.social_interactions), 0)::BIGINT          AS social_interactions
  FROM spartaco_master_products m
  WHERE m.date >= p_start
    AND m.date <= p_end
    AND (p_brand   IS NULL OR m.brand   = p_brand)
    AND (p_product IS NULL OR m.product = p_product)
  GROUP BY COALESCE(m.product, 'Unknown'), COALESCE(m.brand, 'Unknown')
  ORDER BY ad_cost DESC NULLS LAST;
END;
$$;
