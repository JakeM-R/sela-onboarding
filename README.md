# GPU Price Radar

Where Thunder Compute's on-demand GPU prices sit in the live Vast.ai marketplace, and whether that position is getting better or worse.

**Live:** https://jakem-r.github.io/thunder-gpu-radar/

Built by Jake Makking-Robinson. Real data only.

## What it shows

- **Headline:** the share of live Vast.ai H100 hosts that cost more than Thunder's H100.
- **Position table:** per GPU Thunder sells (H100 SXM, A100 80GB, L40, RTX A6000) plus close comparables: Thunder's price, market p10/median/p90, datacenter-only median, Thunder's percentile, share of hosts already rented, change since the last snapshot, and an unusual-move flag.
- **Charts:** today's offers as a strip plot against Thunder's price, and the market median over time.
- **Anchor ladder:** Thunder's own H100 comparison list (Lambda to Google Cloud) with today's Vast.ai median added.

## How it runs

`.github/workflows/snapshot.yml` runs `fetch.py` every 6 hours (standard library only, no key). It queries Vast.ai's public bundles search per GPU model, keeps one price per machine (the cheapest per-GPU bundle), writes `site/data.json`, appends a row to `site/history.json`, commits and redeploys GitHub Pages.

Thunder's prices are hardcoded in `fetch.py` with an as-of date. Update them when thundercompute.com/pricing changes.

```bash
python fetch.py
python -m http.server -d site
```
