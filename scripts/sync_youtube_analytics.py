"""
YouTube Analytics Sync — runs in GitHub Actions every 3 hours.
Fetches per-video metrics via YouTube Analytics API (OAuth2)
and POSTs them to the backend /api/youtube-analytics/sync endpoint.
"""

import os
import sys
import json
import datetime
import re

# Google API imports
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# ── Auth from environment ─────────────────────────────────────────────────────

def get_credentials():
    """Reconstruct OAuth2 credentials from GitHub secrets."""
    token_json = os.environ.get("YOUTUBE_TOKEN_JSON")
    if not token_json:
        print("ERROR: YOUTUBE_TOKEN_JSON not set")
        sys.exit(1)

    token_data = json.loads(token_json)

    creds = Credentials(
        token=token_data.get("token"),
        refresh_token=token_data["refresh_token"],
        token_uri=token_data["token_uri"],
        client_id=token_data["client_id"],
        client_secret=token_data["client_secret"],
        scopes=token_data.get("scopes", [
            "https://www.googleapis.com/auth/youtube.readonly",
            "https://www.googleapis.com/auth/yt-analytics.readonly",
        ]),
    )

    # Refresh if expired
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            print("Refreshing token...")
            creds.refresh(Request())
            print("Token refreshed successfully")

            # Output updated token for secret rotation if needed
            updated_token = {
                "token": creds.token,
                "refresh_token": creds.refresh_token,
                "token_uri": creds.token_uri,
                "client_id": creds.client_id,
                "client_secret": creds.client_secret,
                "scopes": list(creds.scopes) if creds.scopes else [],
            }
            # Write to file for potential secret update
            with open("/tmp/updated_token.json", "w") as f:
                json.dump(updated_token, f)
        else:
            print("ERROR: Cannot refresh credentials")
            sys.exit(1)

    return creds


# ── Build API clients ─────────────────────────────────────────────────────────

def build_clients(creds):
    yt = build("youtube", "v3", credentials=creds)
    yt_anal = build("youtubeAnalytics", "v2", credentials=creds)
    return yt, yt_anal


# ── Fetch channel ID ──────────────────────────────────────────────────────────

def get_channel_id(yt):
    resp = yt.channels().list(part="id,snippet", mine=True).execute()
    ch = resp["items"][0]
    print(f"Channel: {ch['snippet']['title']}  ({ch['id']})")
    return ch["id"]


# ── Fetch all video IDs ──────────────────────────────────────────────────────

def get_all_video_ids(yt, channel_id):
    video_ids = []
    titles = {}
    page_token = None
    while True:
        resp = yt.search().list(
            part="id,snippet",
            channelId=channel_id,
            type="video",
            maxResults=50,
            pageToken=page_token,
        ).execute()
        for item in resp.get("items", []):
            vid = item["id"]["videoId"]
            video_ids.append(vid)
            titles[vid] = item["snippet"]["title"]
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    print(f"Found {len(video_ids)} videos.")
    return video_ids, titles


# ── Parse ISO 8601 duration ──────────────────────────────────────────────────

def parse_duration(iso):
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso)
    if not m:
        return None
    h, mn, s = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mn * 60 + s


# ── Fetch analytics ──────────────────────────────────────────────────────────

METRICS = ",".join([
    "views",
    "estimatedMinutesWatched",
    "averageViewDuration",
    "averageViewPercentage",
    "likes",
    "dislikes",
    "comments",
    "shares",
    "subscribersGained",
    "subscribersLost",
    "annotationImpressions",
])


def fetch_video_analytics(yt_anal, channel_id):
    end_date = datetime.date.today().isoformat()
    resp = yt_anal.reports().query(
        ids=f"channel=={channel_id}",
        startDate="2020-01-01",
        endDate=end_date,
        metrics=METRICS,
        dimensions="video",
        maxResults=200,
        sort="-views",
    ).execute()

    cols = [h["name"] for h in resp["columnHeaders"]]
    rows = resp.get("rows", [])
    return [dict(zip(cols, row)) for row in rows]


def fetch_video_details(yt, video_ids):
    details = {}
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i:i+50]
        resp = yt.videos().list(
            part="id,snippet,contentDetails,statistics",
            id=",".join(chunk),
        ).execute()
        for item in resp.get("items", []):
            dur = item["contentDetails"]["duration"]
            details[item["id"]] = {
                "title": item["snippet"]["title"],
                "published_at": item["snippet"]["publishedAt"],
                "duration_iso": dur,
                "duration_sec": parse_duration(dur),
            }
    return details


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Authenticating...")
    creds = get_credentials()
    yt, yt_anal = build_clients(creds)

    channel_id = get_channel_id(yt)

    print("Fetching video list...")
    video_ids, titles = get_all_video_ids(yt, channel_id)

    print("Fetching analytics data...")
    analytics = fetch_video_analytics(yt_anal, channel_id)

    print("Fetching video details...")
    details = fetch_video_details(yt, video_ids)

    # Merge analytics with details, filtering out private/unlisted junk
    now = datetime.datetime.utcnow().isoformat() + "Z"
    videos = []
    skipped = 0
    for a in analytics:
        vid = a["video"]
        d = details.get(vid, {})
        title = d.get("title", titles.get(vid, ""))
        views = a.get("views", 0) or 0

        # Skip private/unlisted videos (no title) and low view videos
        if not title or views < 1000:
            skipped += 1
            continue

        likes = a.get("likes", 0) or 0
        comments = a.get("comments", 0) or 0
        shares = a.get("shares", 0) or 0
        subs_gained = a.get("subscribersGained", 0) or 0
        subs_lost = a.get("subscribersLost", 0) or 0
        duration_sec = d.get("duration_sec")

        safe_views = views if views > 0 else 1  # avoid division by zero

        # Shorts are <= 180s (YouTube's current limit); long-form is > 180s
        is_short = (duration_sec or 0) <= 180

        videos.append({
            "video_id": vid,
            "title": title,
            "published_at": d.get("published_at"),
            "duration_sec": duration_sec,
            "is_short": is_short,
            "views": views,
            "estimated_minutes_watched": a.get("estimatedMinutesWatched", 0) or 0,
            "average_view_duration": a.get("averageViewDuration", 0) or 0,
            "average_view_percentage": a.get("averageViewPercentage", 0) or 0,
            "likes": likes,
            "dislikes": a.get("dislikes", 0) or 0,
            "comments": comments,
            "shares": shares,
            "subscribers_gained": subs_gained,
            "subscribers_lost": subs_lost,
            "like_rate": likes / safe_views,
            "comment_rate": comments / safe_views,
            "share_rate": shares / safe_views,
            "sub_gain_rate": subs_gained / safe_views,
            "engagement_rate": (likes + comments + shares) / safe_views,
            "fetched_at": now,
        })

    print(f"Processed {len(videos)} videos (skipped {skipped} private/unlisted)")

    # Output JSON
    payload = {"videos": videos}

    # Save to file for potential use
    output_path = os.path.join(os.path.dirname(__file__), "analytics_output.json")
    with open(output_path, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"Saved to {output_path}")

    # POST to backend if BACKEND_URL and SYNC_API_KEY are set
    backend_url = os.environ.get("BACKEND_URL")
    sync_api_key = os.environ.get("SYNC_API_KEY")

    if backend_url and sync_api_key:
        import urllib.request
        url = f"{backend_url.rstrip('/')}/api/youtube-analytics/sync"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {sync_api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode())
                print(f"Backend sync result: {result}")
        except Exception as e:
            print(f"WARNING: Failed to sync to backend: {e}")
            print("Data was saved to file. You can manually import it.")
    else:
        print("BACKEND_URL or SYNC_API_KEY not set — skipping backend sync")
        print("Data saved to file only.")


if __name__ == "__main__":
    main()
