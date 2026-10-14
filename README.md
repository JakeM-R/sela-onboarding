# GPU Unit Economics

What does one GPU earn under different supply choices and utilisation, and which supply choice should come next? A decision tool for a GPU cloud that is scaling capacity. It compares **buy**, **lease** and **rent-in** per physical GPU-hour, with Thunder Compute's list prices as the default sell price.

**Live:** https://jakem-r.github.io/thunder-gpu-radar/

Built by Jake Makking-Robinson. It's a template for real numbers. Every default is public, sourced and dated, and every input is editable. It draws no conclusion about any company's actual margins.

## What it shows

- **Three cards**, one per supply option: median margin per GPU-hour and per GPU-month, an 80% band from a Monte Carlo over utilisation, realised price and rent-in price, the break-even utilisation, the chance of a loss, and the share of draws in which the option earns the most.
- **Margin against utilisation** for all three options, with break-even points and crossovers marked (e.g. "Rent-in beats Buy below X% utilisation").
- **Pooling table:** break-even utilisation at 1.0× to 3.0× pooling. With virtualisation, one physical GPU can carry more than one billed GPU-hour, so pooling is the main driver.
- **Assumptions panel:** every default with its basis (live, sourced or estimate), source and date. The cost inputs are edited in place.

## Live inputs

`.github/workflows/snapshot.yml` runs `fetch.py` every 6 hours (standard library only) and redeploys GitHub Pages.

- **Rent-in:** Vast.ai's public marketplace, one price per machine. The page uses datacenter verified hosts when there are at least 8. Otherwise it falls back to all verified hosts and shows both sample sizes.
- **Power:** EIA API v2 commercial retail electricity price by state. Add a repository secret `EIA_API_KEY` (free at eia.gov/opendata) to turn it on. Without the key, the last snapshot is kept, seeded from EIA Table 5.6.A for April 2026.
- **Thunder list prices** are hardcoded in `fetch.py` with an as-of date. Update them when thundercompute.com/pricing changes.

```bash
EIA_API_KEY=... python fetch.py
python -m http.server -d site
```

## Out of scope

Financing and cost of capital, tax, residual value, staff and software overhead, cluster networking, and per-second sandbox pricing.
