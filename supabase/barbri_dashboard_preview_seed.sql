begin;

insert into public.barbri_plan_snapshots (
  version,status,source_cutoff,forecast_start,forecast_end,current_modeled_roas,target_roas,
  forecast_spend,forecast_revenue,forecast_sales,improvement_pct,strategy_summary
) values (
  '2026-10-28-v1','working','2026-10-26','2026-10-27','2027-01-24',7.8973746263,9.0,
  280333.077586,2522997.698275,967.385773,0.1396192312,
  'Protect Google as the principal revenue engine, improve query and audience discipline, and stage paid-social and CRM tests behind explicit measurement gates.'
)
on conflict (version) do update set
  status=excluded.status, source_cutoff=excluded.source_cutoff, forecast_start=excluded.forecast_start,
  forecast_end=excluded.forecast_end, current_modeled_roas=excluded.current_modeled_roas,
  target_roas=excluded.target_roas, forecast_spend=excluded.forecast_spend,
  forecast_revenue=excluded.forecast_revenue, forecast_sales=excluded.forecast_sales,
  improvement_pct=excluded.improvement_pct, strategy_summary=excluded.strategy_summary;

insert into public.barbri_performance_windows
(snapshot_version,window_key,window_label,start_date,end_date,spend,native_revenue,native_roas,ga4_revenue,ga4_roas,purchases,aov,sort_order)
values
('2026-10-28-v1','180d','180 days','2026-04-30','2026-10-26',268807.7841,2818346.899114,10.484617879,2328881,8.663740925,887,2625.570462,1),
('2026-10-28-v1','90d','90 days','2026-07-29','2026-10-26',161434.264564,1823582.827860,11.296132409,1477098,9.149841912,566,2609.713781,2),
('2026-10-28-v1','30d','30 days','2026-09-27','2026-10-26',65643.94129,435845.850821,6.639544218,553212,8.427464731,248,2230.693548,3),
('2026-10-28-v1','14d','14 days','2026-10-13','2026-10-26',28494.23,76652.921641,2.690120829,100565,3.529311022,91,1105.109890,4),
('2026-10-28-v1','7d','7 days','2026-10-20','2026-10-26',15847.368419,10116.726153,0.638385244,17393,1.097532381,63,276.079365,5)
on conflict (snapshot_version,window_key) do update set
 window_label=excluded.window_label,start_date=excluded.start_date,end_date=excluded.end_date,
 spend=excluded.spend,native_revenue=excluded.native_revenue,native_roas=excluded.native_roas,
 ga4_revenue=excluded.ga4_revenue,ga4_roas=excluded.ga4_roas,purchases=excluded.purchases,
 aov=excluded.aov,sort_order=excluded.sort_order;

insert into public.barbri_measurement_bridge
(snapshot_version,metric_key,label,value,unit,evidence_type,definition,sort_order)
values
('2026-10-28-v1','google_native','Google Ads native',11.296132409,'x','Verified platform result','Last 90 completed days, platform-attributed purchase value divided by Google spend.',1),
('2026-10-28-v1','google_ga4','GA4 Google direct',9.149841912,'x','Verified GA4 result','Last 90 completed days, GA4 session-attributed Google purchase revenue divided by Google spend.',2),
('2026-10-28-v1','portfolio_floor','GA4 direct portfolio floor',5.481748616,'x','Conservative direct floor','Google, scoped Meta-like and LinkedIn-like direct/session revenue divided by estimated cross-channel spend.',3),
('2026-10-28-v1','modeled_current','Modeled current portfolio',7.897374626,'x','Planning assumption','Google native actual plus Meta at 3.0x and LinkedIn at 3.75x, using documented paid-social spend proxies.',4),
('2026-10-28-v1','forecast','90-day portfolio forecast',9.0,'x','Planning target','Forecast revenue divided by the proposed 90-day paid-media budget.',5)
on conflict (snapshot_version,metric_key) do update set
 label=excluded.label,value=excluded.value,unit=excluded.unit,evidence_type=excluded.evidence_type,
 definition=excluded.definition,sort_order=excluded.sort_order;

insert into public.barbri_channel_plan
(snapshot_version,channel_key,channel_label,current_roas,forecast_roas,spend,revenue,sales,evidence_type,role_in_plan,sort_order)
values
('2026-10-28-v1','google','Google + staged tests',11.296132409,12.183706521,175333.077586,2136206.760775,818.562788,'Current ROAS verified natively; forecast is modeled','Principal revenue engine. Protect branded demand, improve state/nonbrand structure, and ring-fence staged tests.',1),
('2026-10-28-v1','meta','Meta',3.0,3.5,79278.75,277475.625,106.762457,'Current and forecast are planning assumptions pending native validation','Retargeting, CRM, education and controlled prospecting, with purchaser suppression.',2),
('2026-10-28-v1','linkedin','LinkedIn',3.75,4.25,25721.25,109315.3125,42.060528,'Current and forecast are planning assumptions pending native validation','Known-audience and professional-context support, not the primary revenue engine.',3)
on conflict (snapshot_version,channel_key) do update set
 channel_label=excluded.channel_label,current_roas=excluded.current_roas,forecast_roas=excluded.forecast_roas,
 spend=excluded.spend,revenue=excluded.revenue,sales=excluded.sales,evidence_type=excluded.evidence_type,
 role_in_plan=excluded.role_in_plan,sort_order=excluded.sort_order;

insert into public.barbri_monthly_plan
(snapshot_version,month_key,month_label,date_range,spend,revenue,sales,roas,sort_order)
values
('2026-10-28-v1','m1','Month 1','Oct 27 to Nov 25, 2026',86635.591349,790565.807893,303.135654,9.125185107,1),
('2026-10-28-v1','m2','Month 2','Nov 26 to Dec 25, 2026',95928.244461,875938.129880,335.848943,9.131180653,2),
('2026-10-28-v1','m3','Month 3','Dec 26, 2026 to Jan 24, 2027',97769.241776,856493.760502,328.401175,8.760360057,3)
on conflict (snapshot_version,month_key) do update set
 month_label=excluded.month_label,date_range=excluded.date_range,spend=excluded.spend,
 revenue=excluded.revenue,sales=excluded.sales,roas=excluded.roas,sort_order=excluded.sort_order;

insert into public.barbri_roadmap
(snapshot_version,phase_key,timing,theme,actions,decision_gate,primary_kpi,owner_boundary,sort_order)
values
('2026-10-28-v1','phase1','Days 1 to 15','Measurement readiness','Confirm the approved commerce source, purchase-value definitions and active primary actions before short-window decisions.','Purchase count and value reconcile to the source BARBRI approves.','Governed revenue parity','BARBRI and its existing tracking partner own remediation. EIC consumes the approved outputs.',1),
('2026-10-28-v1','phase2','Days 16 to 30','Stabilize and restructure','Protect brand exact, tighten phrase routing, separate proven prep intent from broad nonbrand, rank states and maintain a PMax control.','No material loss in mature revenue while routing and budget ownership improve.','GA4 and governed ROAS','EIC paid-media execution.',2),
('2026-10-28-v1','phase3','Days 31 to 60','Controlled scaling','Expand qualified state and competitor cells, test proof and testimonial messages, and start ring-fenced CTV and YouTube CRM pilots after readiness checks.','Sufficient governed-sale signal for scaling cells, plus valid audience and destination QA.','Incremental sale revenue','EIC execution after BARBRI approves audiences, assets and measurement readiness.',3),
('2026-10-28-v1','phase4','Days 61 to 90','Optimize and add second test wave','Continue qualified CTV and YouTube cells. Add TikTok CRM and tightly bounded law-school geofencing only when eligibility and consent requirements are met.','Forecast variance is explained and each campaign receives an explicit scale, hold, reduce or stop-loss classification.','Governed ROAS and sales','EIC optimization within approved media scope. Tracking implementation and CRO remain outside current scope.',4)
on conflict (snapshot_version,phase_key) do update set
 timing=excluded.timing,theme=excluded.theme,actions=excluded.actions,decision_gate=excluded.decision_gate,
 primary_kpi=excluded.primary_kpi,owner_boundary=excluded.owner_boundary,sort_order=excluded.sort_order;

commit;
