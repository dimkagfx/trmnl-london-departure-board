import requests
import os
import logging
import json
from datetime import datetime
from zoneinfo import ZoneInfo

UK_TZ = ZoneInfo("Europe/London")

# --- LOGGING CONFIGURATION ---
logging.Formatter.converter = lambda *args: datetime.now(UK_TZ).timetuple()
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# --- CONFIGURATION ---
# These should be set as "Secrets" in your GitHub Repository
TFL_APP_KEY = os.getenv('TFL_APP_KEY', 'a7fa36f15bb8432592a60e78c4847595') 
NR_TOKEN = os.getenv('NR_TOKEN', '089d8096-3bb0-4634-8b85-49bb636f5d7e') # National Rail Darwin Token
TRMNL_WEBHOOK_URL = os.getenv('TRMNL_WEBHOOK_URL', 'https://trmnl.com/api/custom_plugins/e85c39ef-f4db-481e-a498-d2977f773112')

TFL_STATION = os.getenv('TFL_STATION', '940GZZDLSIT') # Comma-separated TfL StopPoint IDs
NR_STATION = os.getenv('NR_STATION', 'SFA') # Comma-separated National Rail CRS codes
# Comma-separated list of destinations to filter by (e.g. 'St Pancras, Ashford'). Leave empty for all.
NR_DESTINATIONS = os.getenv('NR_DESTINATIONS', 'St Pancras')

def get_mins_from_time(time_str):
    """
    Calculates minutes from 'now' until a given HH:MM timestamp.
    Necessary for sorting National Rail and DLR trains together.
    """
    if not time_str or ":" not in time_str:
        return 0
    
    now = datetime.now(UK_TZ)
    try:
        # Create a datetime object for today at the target time
        parsed_time = datetime.strptime(time_str, "%H:%M")
        target = now.replace(
            hour=parsed_time.hour, minute=parsed_time.minute, second=0, microsecond=0
        )
        # Calculate difference in minutes
        diff = (target - now).total_seconds() / 60
        
        # Handle midnight rollover (e.g., now is 23:55, target is 00:05)
        if diff < -720:  # If target appears to be more than 12 hours in the past
            diff += 1440 # Add 24 hours
            
        return int(diff) if diff > 0 else 0
    except Exception:
        return 0

def fetch_rail():
    """
    Fetches departures from the specified National Rail station.
    Uses the Huxley 2 JSON wrapper to avoid dealing with National Rail's SOAP XML.
    """
    # Parse allowed destinations into a lowercase list for matching
    allowed_dests = [d.strip().lower() for d in NR_DESTINATIONS.split(',')] if NR_DESTINATIONS else []
    
    rail_list = []
    
    # Huxley/Darwin only supports one origin per request, so we iterate
    stations = [s.strip() for s in NR_STATION.split(',') if s.strip()]
    for crs in stations:
        url = f"https://huxley2.azurewebsites.net/departures/{crs}?accessToken={NR_TOKEN}"
        
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        logging.info(f"Raw Rail response for {crs}:\n{response.text}")
        data = response.json()
        
        services = data.get('trainServices') or []
        
        for s in services:
            dest_name = s['destination'][0]['locationName']
            
            # If a destination filter is set, skip trains not matching the allowed destinations
            if allowed_dests:
                if not any(allowed in dest_name.lower() for allowed in allowed_dests):
                    continue

            # Determine best time to use for sorting (Estimated vs Scheduled)
            etd = s.get('etd') # e.g., "On time" or "14:10"
            std = s.get('std') # e.g., "14:05"
            
            rail_list.append({
                "mode": "Rail",
                # Shorten "Highspeed" to save e-ink screen space
                "dest": dest_name.replace("Highspeed", "HS"),
                "scheduled": std,
                "estimated": etd,
                "is_delayed": etd != "On time" and etd != "Cancelled",
                "is_cancelled": etd == "Cancelled"
            })
            
    return rail_list

def fetch_tfl():
    """
    Fetches TfL arrivals and general London transport status alerts.
    """
    # TfL natively supports comma-separated StopPoint IDs in the URL
    arrivals_url = f"https://api.tfl.gov.uk/StopPoint/{TFL_STATION}/Arrivals"
    status_url = "https://api.tfl.gov.uk/Line/Mode/tube,dlr,overground,elizabeth-line/Status"
    params = {'app_key': TFL_APP_KEY}
    
    trains = []
    alerts = []
    
    # 1. Fetch TfL Trains
    arrivals_res = requests.get(arrivals_url, params=params, timeout=10)
    arrivals_res.raise_for_status()
    logging.info(f"Raw TfL arrivals response:\n{arrivals_res.text}")
    for t in arrivals_res.json():
        # Parse the ISO datetime string (UTC) and convert to local UK time
        expected_utc = datetime.fromisoformat(t['expectedArrival'].replace("Z", "+00:00"))
        scheduled = expected_utc.astimezone(UK_TZ).strftime("%H:%M")
        
        raw_dest = t.get('destinationName', 'Unknown')
        clean_dest = raw_dest.replace(" DLR Station", "").replace(" Underground Station", "").replace(" Rail Station", "")
        
        trains.append({
            "mode": t.get('lineName', 'TfL'),
            "dest": clean_dest,
            "scheduled": scheduled,
            "is_delayed": False,
            "is_cancelled": False
        })
    
    # 2. Fetch Service Alerts
    status_res = requests.get(status_url, params=params, timeout=10)
    status_res.raise_for_status()
    logging.info(f"Raw TfL status response:\n{status_res.text}")
    for s in status_res.json():
        # Severity < 10 indicates anything worse than "Good Service"
        if s['lineStatuses'][0]['statusSeverity'] < 10:
            alerts.append({
                "line": s['name'],
                "status": s['lineStatuses'][0]['statusSeverityDescription']
            })
                
    return trains, alerts

def main():
    """
    Main orchestrator: Fetches, merges, and pushes to TRMNL.
    """        
    if not TRMNL_WEBHOOK_URL:
        logging.error("TRMNL_WEBHOOK_URL is not set. Exiting.")
        return

    logging.info("Fetching data from TfL and National Rail...")
    
    # 1. Get data from all sources
    tfl_trains, alerts = fetch_tfl()
    rail_trains = fetch_rail()
    
    # 2. Combine and sort chronologically (handling midnight rollover)
    # This intermingles TfL and Rail based on absolute scheduled/estimated time
    combined_trains = sorted(
        tfl_trains + rail_trains,
        key=lambda x: get_mins_from_time(
            x.get('estimated') if x.get('estimated') not in (None, 'On time', 'Cancelled') else x['scheduled']
        )
    )
    
    # 3. Prepare TRMNL Payload
    payload = {
        "merge_variables": {
            "data": {
                "trains": combined_trains,
                "alerts": alerts,
                "last_updated": datetime.now(UK_TZ).strftime("%H:%M")
            }
        }
    }

    logging.info(f"Pushing {len(combined_trains)} departures and {len(alerts)} alerts to TRMNL...")
    logging.info(f"Payload to TRMNL:\n{json.dumps(payload, indent=2)}")
    
    # 4. Push to TRMNL Webhook
    r = requests.post(TRMNL_WEBHOOK_URL, json=payload, timeout=10)
    r.raise_for_status()
    logging.info(f"Successfully pushed to TRMNL (Status: {r.status_code})")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logging.exception("An unexpected error occurred during execution:")
        raise