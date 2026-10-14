"""GPU unit economics: refresh the live inputs.

Runs every 6 hours from .github/workflows/snapshot.yml. Standard library only.
Writes site/data.json with:
  - rent-in supply prices from Vast.ai's public marketplace (one price per machine),
    tagged datacenter / verified so the page can use like-for-like hosts only;
  - US commercial electricity prices by state from the EIA API (needs EIA_API_KEY;
    without it the previous snapshot, or the sourced fallback below, is kept).
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
OUT = os.path.join(ROOT, "site", "data.json")
VAST = "https://console.vast.ai/api/v0/bundles/"
EIA = "https://api.eia.gov/v2/electricity/retail-sales/data/"

# Thunder's on-demand list prices, from thundercompute.com/pricing on 14 Oct 2026.
THUNDER_AS_OF = "2026-10-14"
GPUS = [
    {"key": "h100", "label": "H100 SXM 80GB", "vast": ["H100 SXM"], "thunder": 3.20},
    {"key": "a100", "label": "A100 80GB", "vast": ["A100 SXM4", "A100 PCIE"], "min_ram": 79000, "thunder": 1.09},
]

# States offered in the power picker: common US data-centre markets plus the US average.
STATES = ["US", "VA", "TX", "GA", "OR", "WA", "AZ", "OH", "IL", "NY", "CA"]

# Fallback: EIA Electric Power Monthly, Table 5.6.A, commercial sector, April 2026 (cents/kWh),
# as republished by kilowattlogic.com. Replaced by the live API whenever EIA_API_KEY is set.
POWER_FALLBACK = {
    "period": "2026-04", "source": "EIA Electric Power Monthly Table 5.6.A (Apr 2026), via kilowattlogic.com",
    "cents": {"US": 13.51, "VA": 10.33, "TX": 8.35, "GA": 10.56, "OR": 10.62, "WA": 11.74,
              "AZ": 11.49, "OH": 13.65, "IL": 13.89, "NY": 21.88, "CA": 25.75},
}


def get(url, tries=5):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "gpu-unit-economics"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            if attempt == tries - 1:
                raise
            print(f"retry {url[:60]}: {e}", file=sys.stderr)
            time.sleep(5 * (attempt + 1))


def vast(gpu_name):
    q = {"gpu_name": {"eq": gpu_name}, "type": "on-demand", "limit": 3000}
    return get(f"{VAST}?q={urllib.parse.quote(json.dumps(q))}")["offers"]


def offers_for(g, raw):
    # Vast lists the same host several times as fractional bundles (1, 2, 4, 8 GPUs).
    # Keep the cheapest per-GPU price per machine.
    per_machine = {}
    for name in g["vast"]:
        for o in raw[name]:
            if not o.get("num_gpus") or o.get("dph_total") is None:
                continue
            ram = o.get("gpu_ram") or 0
            if ram < g.get("min_ram", 0):
                continue
            price = round(o["dph_total"] / o["num_gpus"], 4)
            m = per_machine.get(o["machine_id"])
            if m is None or price < m["p"]:
                per_machine[o["machine_id"]] = {
                    "p": price, "dc": o.get("hosting_type") == 1,
                    "verified": o.get("verification") == "verified",
                    "geo": (o.get("geolocation") or "").split(",")[-1].strip(),
                }
    return sorted(per_machine.values(), key=lambda o: o["p"])


def power(previous):
    key = os.environ.get("EIA_API_KEY")
    if not key:
        print("EIA_API_KEY not set: keeping previous power snapshot", file=sys.stderr)
        return previous or POWER_FALLBACK
    params = [("api_key", key), ("frequency", "monthly"), ("data[0]", "price"),
              ("facets[sectorid][]", "COM"), ("sort[0][column]", "period"),
              ("sort[0][direction]", "desc"), ("length", "200")]
    params += [("facets[stateid][]", s) for s in STATES]
    rows = get(f"{EIA}?{urllib.parse.urlencode(params)}")["response"]["data"]
    latest = max(r["period"] for r in rows)
    cents = {r["stateid"]: float(r["price"]) for r in rows if r["period"] == latest and r.get("price")}
    if len(cents) < len(STATES) // 2:
        print(f"EIA returned {len(cents)} states for {latest}: keeping previous", file=sys.stderr)
        return previous or POWER_FALLBACK
    return {"period": latest, "source": "EIA API v2, electricity/retail-sales, commercial sector",
            "cents": {s: cents[s] for s in STATES if s in cents}}


def main():
    now = datetime.now(timezone.utc).replace(microsecond=0)
    previous = json.load(open(OUT)) if os.path.exists(OUT) else {}

    raw = {name: vast(name) for name in sorted({n for g in GPUS for n in g["vast"]})}
    gpus = []
    for g in GPUS:
        offers = offers_for(g, raw)
        dc = [o["p"] for o in offers if o["dc"] and o["verified"]]
        gpus.append({"key": g["key"], "label": g["label"], "thunder": g["thunder"], "offers": offers})
        print(f'{g["label"]:<14} n={len(offers):>3} dc+verified={len(dc)} '
              f'median={statistics.median(dc) if dc else None}', file=sys.stderr)

    data = {"generatedAt": now.isoformat(), "thunderAsOf": THUNDER_AS_OF,
            "power": power(previous.get("power")), "gpus": gpus}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
