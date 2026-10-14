"""GPU Price Radar: snapshot Vast.ai's public marketplace and append to history.

Runs every 6 hours from .github/workflows/snapshot.yml. No API key needed.
Writes site/data.json (latest offers) and appends one row to site/history.json.
"""
import json
import os
import statistics
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, "site")
VAST = "https://console.vast.ai/api/v0/bundles/"
HISTORY_CAP = 4 * 365  # one year of 6-hourly rows

# Thunder's on-demand instance prices, from thundercompute.com/pricing on 14 Oct 2026.
THUNDER_AS_OF = "2026-10-14"

# Each row: Vast gpu_name values that make up the market, an optional VRAM floor (MB),
# Thunder's price for that SKU, or the Thunder SKU it is the closest comparable to.
GPUS = [
    {"key": "h100-sxm", "label": "H100 SXM 80GB", "vast": ["H100 SXM"], "thunder": 3.20},
    {"key": "a100-80", "label": "A100 80GB", "vast": ["A100 SXM4", "A100 PCIE"], "min_ram": 79000, "thunder": 1.09},
    {"key": "l40", "label": "L40 48GB", "vast": ["L40"], "thunder": 0.79},
    {"key": "a6000", "label": "RTX A6000 48GB", "vast": ["RTX A6000"], "thunder": 0.35},
    {"key": "h100-pcie", "label": "H100 PCIe 80GB", "vast": ["H100 PCIE"], "comparable_to": "h100-sxm"},
    {"key": "h100-nvl", "label": "H100 NVL 94GB", "vast": ["H100 NVL"], "comparable_to": "h100-sxm"},
    {"key": "l40s", "label": "L40S 48GB", "vast": ["L40S"], "comparable_to": "l40"},
    {"key": "a100-40", "label": "A100 40GB", "vast": ["A100 SXM4", "A100 PCIE"], "max_ram": 79000, "comparable_to": "a100-80"},
]

# Thunder's own H100 comparison ladder (on-demand list prices it shows, checked 13 Oct 2026).
ANCHORS = [
    ["Lambda", 3.29], ["Runpod", 3.99], ["Paperspace", 5.95], ["CoreWeave", 6.16],
    ["AWS", 6.88], ["Azure", 6.98], ["Oracle Cloud", 10.00], ["Google Cloud", 10.98],
]


def vast(gpu_name):
    q = {"gpu_name": {"eq": gpu_name}, "type": "on-demand", "limit": 3000}
    url = f"{VAST}?q={urllib.parse.quote(json.dumps(q))}"
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "gpu-price-radar"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)["offers"]
        except Exception as e:  # noqa: BLE001
            if attempt == 4:
                raise
            print(f"retry {gpu_name}: {e}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))


def pct(sorted_vals, p):
    if not sorted_vals:
        return None
    k = (len(sorted_vals) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(sorted_vals) - 1)
    return round(sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (k - lo), 4)


def summarise(offers):
    prices = sorted(o["p"] for o in offers)
    dc = sorted(o["p"] for o in offers if o["dc"])
    return {
        "n": len(prices), "nAvailable": sum(o["avail"] for o in offers), "nDatacenter": len(dc),
        "min": prices[0] if prices else None,
        "p10": pct(prices, .1), "p25": pct(prices, .25), "p50": pct(prices, .5),
        "p75": pct(prices, .75), "p90": pct(prices, .9),
        "dcP50": pct(dc, .5),
        "rentedShare": round(1 - sum(o["avail"] for o in offers) / len(offers), 3) if offers else None,
    }


def main():
    now = datetime.now(timezone.utc).replace(microsecond=0)
    raw = {name: vast(name) for name in sorted({n for g in GPUS for n in g["vast"]})}

    rows = []
    for g in GPUS:
        # One price per machine: Vast lists the same host several times as fractional
        # bundles (1, 2, 4, 8 GPUs). Keep the cheapest per-GPU price per machine.
        per_machine = {}
        for name in g["vast"]:
            for o in raw[name]:
                if not o.get("num_gpus") or o.get("dph_total") is None:
                    continue
                ram = o.get("gpu_ram") or 0
                if ram < g.get("min_ram", 0) or ram >= g.get("max_ram", 10**9):
                    continue
                price = o["dph_total"] / o["num_gpus"]
                m = per_machine.get(o["machine_id"])
                if m is None or price < m["p"]:
                    per_machine[o["machine_id"]] = {
                        "p": round(price, 4), "avail": bool(o.get("rentable") and not o.get("rented")),
                        "dc": o.get("hosting_type") == 1, "verified": o.get("verification") == "verified",
                        "geo": (o.get("geolocation") or "").split(",")[-1].strip(),
                        "rel": round(o.get("reliability") or 0, 3),
                    }
                elif o.get("rentable") and not o.get("rented"):
                    m["avail"] = True
        offers = sorted(per_machine.values(), key=lambda o: o["p"])
        rows.append({**{k: g.get(k) for k in ("key", "label", "thunder", "comparable_to")},
                     "vastNames": g["vast"], "offers": offers, **summarise(offers)})
        print(f'{g["label"]:<16} n={len(offers):>3} p50={rows[-1]["p50"]}', file=sys.stderr)

    data = {"generatedAt": now.isoformat(), "thunderAsOf": THUNDER_AS_OF, "anchors": ANCHORS,
            "anchorsAsOf": "2026-10-13", "gpus": rows}
    os.makedirs(SITE, exist_ok=True)
    with open(os.path.join(SITE, "data.json"), "w") as f:
        json.dump(data, f, separators=(",", ":"))

    hist_path = os.path.join(SITE, "history.json")
    history = json.load(open(hist_path)) if os.path.exists(hist_path) else []
    history.append({"t": now.isoformat(), "gpus": {
        r["key"]: {k: r[k] for k in ("n", "nAvailable", "min", "p10", "p25", "p50", "p75", "p90", "dcP50", "rentedShare")}
        for r in rows}})
    with open(hist_path, "w") as f:
        json.dump(history[-HISTORY_CAP:], f, separators=(",", ":"))


if __name__ == "__main__":
    main()
