# TRMNL TfL & National Rail Departures

A Python aggregator that fetches live departure times from Transport for London (TfL) and National Rail, merges them, and pushes them to a [TRMNL](https://trmnl.com) e-ink display via webhook.

## Features
* Fetches TfL arrivals (DLR, Tube, etc.) and live service alerts.
* Fetches National Rail departures (via Huxley 2 / Darwin) with destination filtering.
* Merges and sorts departures chronologically, accurately handling UK timezones and midnight rollovers.
* Identifies delayed and cancelled rail services.
* Includes a GitHub Actions workflow to run automatically every minute.

## Environment Variables
Configure the script's behavior using the following environment variables.

### API Keys (Secrets)
* `TRMNL_WEBHOOK_URL` **(Required)**: The webhook URL provided by your TRMNL plugin.
* `TFL_APP_KEY`: Your TfL API key (falls back to a default if not set).
* `NR_TOKEN`: Your National Rail Darwin API token (falls back to a default if not set).

### Station Configuration
* `TFL_STATION`: Comma-separated TfL StopPoint IDs. Default: `940GZZDLSIT` (Stratford International DLR).
* `NR_STATION`: Comma-separated National Rail CRS codes. Default: `SFA` (Stratford International).
* `NR_DESTINATIONS`: Comma-separated list of National Rail destinations to filter by (e.g., `St Pancras, Ashford`). Default: `St Pancras`. Leave empty to return all destinations.

## Local Setup
1. Clone this repository.
2. Install dependencies:
   ```bash
   pip install requests
   ```
3. Run the aggregator script locally, passing your TRMNL webhook URL:
   ```bash
   TRMNL_WEBHOOK_URL="https://your-trmnl-webhook-url..." python aggregator.py
   ```

## Automated Deployment (GitHub Actions)
This repository contains a GitHub Actions workflow (`update-trmnl.yml`) to automatically push new data to your display every minute.

1. Navigate to your GitHub repository's **Settings** > **Secrets and variables** > **Actions**.
2. Create a new **Repository Secret** named `TRMNL_WEBHOOK_URL` containing your TRMNL plugin webhook.
3. *(Optional)* Add `TFL_APP_KEY` and `NR_TOKEN` as Repository Secrets if you want to use your own API keys.
4. The workflow will now trigger every minute automatically. You can also trigger it manually from the **Actions** tab.

## License
This project is open-source. Feel free to fork and customize it for your own daily commute!