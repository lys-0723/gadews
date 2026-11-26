"""Official NOAA and NASA products with different spatial and temporal supports."""
import base64
import calendar
from datetime import date, datetime, timedelta
from html import unescape
from io import BytesIO
import re
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

HEAT = "https://downloads.psl.noaa.gov/Datasets/marinehw/NMME_prob90_latest.nc"
ENSO = "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/"
WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?"
COLORS = "https://gibs.earthdata.nasa.gov/colormaps/v1.3/GPM_Precipitation_Rate.xml"
RAIN = "IMERG_Precipitation_Rate_30min"


def month(start, offset):
    index = start.year * 12 + start.month - 1 + offset
    return date(index // 12, index % 12 + 1, 1)


def enso(read):
    html = unescape(read(ENSO).decode("utf-8", "replace"))
    table = re.search(r'<table\s+id="probabilities-table"[^>]*>(.*?)</table>', html, re.S).group(1)
    issue = re.search(r'ENSO Probabilities data for ([A-Za-z]+ \d{4})', table).group(1)
    start = datetime.strptime(issue, "%B %Y").date()
    headers = re.findall(r'<th scope="col">([^<]+)</th>', table)
    if headers != ["Season", "La Niña", "Neutral", "El Niño"]:
        raise ValueError("unexpected CPC column order")
    rows = []
    for row in re.findall(r'<tr>(.*?)</tr>', table, re.S):
        label = re.search(r'<abbr>([A-Z]{3})\s', row).group(1)
        # CPC's first season straddles the issue month (e.g. OND in November).
        first = month(start, len(rows) - 1)
        expected = "".join(calendar.month_abbr[month(first, i).month][0] for i in range(3))
        values = [int(v) for v in re.findall(r'<td>(\d+)</td>', row)]
        if label != expected or len(values) != 3 or sum(values) != 100 or max(values) > 100:
            raise ValueError("invalid CPC probability row")
        rows.append(dict(start=first.isoformat(), end=month(first, 2).isoformat(),
                         cold=values[0], neutral=values[1], warm=values[2]))
    if len(rows) != 9:
        raise ValueError("incomplete CPC table")
    return dict(series=[], catalogUrl=ENSO, issueMonth=start.isoformat(), seasons=rows)


def heat_arrays(h, station, point):
    import numpy as np
    lat, lon, leads = (h[key][:] for key in ("lat", "lon", "lead_time"))
    variable = h["mhw_probability"]
    axis = h["start_time"]
    epoch = re.fullmatch(rb"days since (\d{4}-\d\d-\d\d) 00:00:00", axis.attrs["units"])
    if not (epoch and np.array_equal(lat, np.arange(-90, 91)) and np.array_equal(lon, np.arange(360))
            and np.array_equal(leads, np.arange(12) + 0.5) and variable.shape == (12, 181, 360, len(axis))
            and np.all(np.diff(axis[:]) > 0)):
        raise ValueError("unrecognised NOAA grid or time axis")
    issued = date.fromisoformat(epoch[1].decode()) + timedelta(days=int(axis[-1]))
    raw = variable[:, :, :, -1]
    valid = np.isfinite(raw)
    if issued.day != 1 or not valid.any() or np.any((raw[valid] < 0) | (raw[valid] > 1)):
        raise ValueError("invalid NOAA probability run")
    dates = [month(issued, i).isoformat() for i in range(len(leads))]
    iy, ix = int(np.abs(lat - station[1]).argmin()), int(np.abs(lon - station[2]).argmin())
    values = [round(float(v) * 100, 2) if np.isfinite(v) else None for v in raw[:, iy, ix]]
    series = point(station, float(lat[iy]), float(lon[ix]), dates, [("mhw_probability", "%", values)], HEAT)
    # South-to-north, 0..359 E. A byte encodes rounded percentage; 255 is missing.
    packed = np.where(valid, np.rint(raw * 100), 255).astype("uint8")
    maps = [base64.b64encode(frame.tobytes()).decode("ascii") for frame in packed]
    return dict(series=[series], issueMonth=issued.isoformat(), heatMaps=maps, catalogUrl=HEAT)


def heatwave(previous, station, point):
    import h5py
    headers = {"User-Agent": "GADEWS-public-environment/1.0"}
    if previous.get("sourceEtag") and previous.get("heatMaps"):
        headers["If-None-Match"] = previous["sourceEtag"]
    try:
        with urlopen(Request(HEAT, headers=headers, method="HEAD"), timeout=100) as response:
            etag = response.headers.get("ETag")
    except HTTPError as exc:
        if exc.code != 304 or "If-None-Match" not in headers:
            raise
        etag = previous["sourceEtag"]
    if etag and "If-None-Match" in headers and etag == previous["sourceEtag"]:
        return {k: previous[k] for k in ("series", "issueMonth", "heatMaps", "catalogUrl", "sourceEtag")}
    # Read only HDF5 blocks containing the latest run, not the entire historical archive.
    import fsspec
    import aiohttp
    options = {"timeout": aiohttp.ClientTimeout(total=100), "trust_env": True}
    # If the provider replaces the file during the read, discard the partial run.
    guard = {"If-Match": etag} if etag else {}
    with fsspec.open(HEAT, "rb", block_size=524288, cache_type="blockcache",
                     client_kwargs=options, headers=guard) as remote, h5py.File(remote, "r") as h:
        result = heat_arrays(h, station, point)
    if etag:
        result["sourceEtag"] = etag
    return result


def imerg(read, stations):
    from PIL import Image
    capabilities = ET.fromstring(read(WMS + "SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities"))
    layer = next(n for n in capabilities.iter("Layer") if n.findtext("Name") == RAIN)
    stamp = layer.find("Extent[@name='time']").get("default")
    datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ")
    palette = {}
    for cmap in ET.fromstring(read(COLORS)).findall("ColorMap"):
        if cmap.get("title") not in ("Rain Rate", "Snow Rate") or cmap.get("units") != "mm/hr":
            continue
        for entry in cmap.findall("./Entries/ColorMapEntry"):
            rgb = tuple(map(int, entry.get("rgb").split(",")))
            bounds = re.fullmatch(r'\[([\d.]+),([\d.]+|\+INF)\)', entry.get("sourceValue", ""))
            if bounds:
                palette[rgb] = (cmap.get("title"), float(bounds[1]), None if bounds[2] == "+INF" else float(bounds[2]))
    if not palette:
        raise ValueError("missing GIBS colour scale")
    frames = []
    for site, lat, lon in stations:
        bbox = ",".join(f"{v:.3f}" for v in (lon-3, lat-3, lon+3, lat+3))
        url = WMS + urlencode(dict(SERVICE="WMS", VERSION="1.1.1", REQUEST="GetMap", SRS="EPSG:4326",
            BBOX=bbox, WIDTH=257, HEIGHT=257, FORMAT="image/png", TRANSPARENT="TRUE",
            LAYERS="Coastlines_15m," + RAIN, STYLES="", TIME=stamp))
        png = read(url)
        with Image.open(BytesIO(png)) as image:
            if image.format != "PNG" or image.size != (257, 257) or len(png) > 160000:
                raise ValueError("invalid GIBS image")
            r, g, b, a = image.convert("RGBA").getpixel((128, 128))
        rate = palette.get((r, g, b)) if a == 255 else None
        frames.append(dict(site=site, url=url, png=base64.b64encode(png).decode("ascii"), rate=rate))
    return dict(series=[], imageryTime=stamp, frames=frames, catalogUrl="https://gpm.nasa.gov/data/imerg")
