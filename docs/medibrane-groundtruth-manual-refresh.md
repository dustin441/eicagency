# MediBrane GroundTruth manual refresh

Use this procedure when GroundTruth data in the MediBrane dashboard needs to be refreshed manually.

## Export the workbook from GroundTruth

1. Sign in to [GroundTruth Ads Manager](https://ads.groundtruth.com).
2. Open the hamburger menu and select **Reports**.
3. Select **Create Report**.
4. Use these settings:
   - **Report name:** `Medibrane Location Dashboard Refresh YYYY-MM-DD to YYYY-MM-DD`
   - **Report type:** `Location`
   - **Organization:** `EIC Agency`
   - **Account:** `Medibrane`
   - **Campaigns:** select every campaign that should be refreshed
   - **Start date / End date:** select the exact reporting range with the calendar controls
   - **Schedule delivery:** off
   - **Generate report now:** on
5. Save the report once.
6. Wait for its status to change from **Pending** to completed. Do not create repeated copies while it is pending.
7. Download the completed XLSX without opening or resaving it.

The native Location workbook should contain campaign name and ID, ZIP, city, state, impressions, clicks, and total spend. Its filename should retain the report range, for example `location_2026-09-17_2026-09-30.xlsx`.

## Upload it to the dashboard

1. Open the MediBrane dashboard and find **GroundTruth report upload**.
2. Choose **Collected on**, meaning the date the export was generated or downloaded.
3. Leave **Report start** and **Report end** blank when the XLSX filename contains a valid `YYYY-MM-DD_YYYY-MM-DD` range. Otherwise enter both dates exactly.
4. Select the unchanged XLSX file and upload it.
5. Confirm the success message reports the expected:
   - campaign count;
   - source/report date range;
   - source-row count;
   - location-row count;
   - warnings, if any.
6. Refresh the dashboard and spot-check spend, impressions, clicks, and geographic totals against the GroundTruth report.

## Safety and troubleshooting

- Only authenticated agency users can see or use the uploader.
- Do not rename columns, delete rows, change number formats, or combine sheets manually.
- A repeated workbook is rejected using its SHA-256 content hash, even if it was renamed.
- Invalid dates, identifiers, ZIPs, metrics, and overlapping workbook coverage fail before any data changes.
- A Location report replaces only the uploaded campaigns and geographic levels represented in that report. Unrelated campaigns and other geographic levels remain unchanged.
- Location reports do not supply Reach. The importer preserves the current Reach value rather than replacing it with zero.
- GroundTruth report generation is asynchronous. If a report remains **Pending**, wait and check again instead of creating duplicates.
- If an upload fails, save the exact dashboard error and the original XLSX, then escalate to the agency dashboard owner.
