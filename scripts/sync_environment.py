"""Build a versioned public environmental snapshot from bounded anonymous API reads."""
import argparse
import concurrent.futures
import csv
from datetime import date, datetime, timedelta, timezone
import json
import math
import os
import re
from pathlib import Path
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

if __package__:
    from . import climate_products
else:
    import climate_products

ROOT = Path(__file__).resolve().parents[1]
BUNDLED = ROOT / "public/data/environment/snapshot.json"
WEATHER = "https://api.open-meteo.com/v1/forecast"
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
MARINE = "https://marine-api.open-meteo.com/v1/marine"
FLOOD = "https://flood-api.open-meteo.com/v1/flood"
POWER = "https://power.larc.nasa.gov/api/temporal/daily/point"
CW = "https://coastwatch.pfeg.noaa.gov/erddap/griddap/"
SST = "ncdcOisst21NrtAgg_LonPM180"
VIIRS = "noaacwN20VIIRSchlaDaily"
STAC = "https://stac.marine.copernicus.eu/metadata/"
WMTS = "https://wmts.marine.copernicus.eu/teroWmts"
STATIONS = [("guangzhou", 23.13, 113.26), ("zhanjiang", 21.27, 110.36),
            ("mekong", 10.04, 105.78), ("chanthaburi", 12.61, 102.1), ("andhra", 16.51, 80.64)]
SEA = ("offshore", 20.5, 111.5)
CMEMS = {
    "chl-l3": ("OCEANCOLOUR_GLO_BGC_L3_NRT_009_101", "plankton_nrt_l3-multi-4km_P1D_", "CHL"),
    "chl-l4": ("OCEANCOLOUR_GLO_BGC_L4_NRT_009_102", "plankton_nrt_l4-gapfree-multi-4km_P1D_", "CHL"),
    "ocean-temp": ("GLOBAL_ANALYSISFORECAST_PHY_001_024", "phy-thetao_anfc_0.083deg_P1D-m_", "thetao"),
    "salinity": ("GLOBAL_ANALYSISFORECAST_PHY_001_024", "phy-so_anfc_0.083deg_P1D-m_", "so"),
    "oxygen": ("GLOBAL_ANALYSISFORECAST_BGC_001_028", "bgc-bio_anfc_0.25deg_P1D-m_", "o2"),
    "ph": ("GLOBAL_ANALYSISFORECAST_BGC_001_028", "bgc-car_anfc_0.25deg_P1D-m_", "ph"),
}


def endpoint(base, **params):
    return base + "?" + urlencode(params)


def read(url):
    for attempt in range(2):
        try:
            with urlopen(Request(url, headers={"User-Agent": "GADEWS-public-environment/1.0"}), timeout=18) as response:
                data = response.read(3_000_001)
                if len(data) > 3_000_000:
                    raise ValueError("oversized response")
                return data
        except HTTPError as exc:
            if attempt or exc.code not in (429, 502, 503, 504):
                raise
            retry = exc.headers.get("Retry-After", "2")
            if not retry.isdigit() or int(retry) > 15:
                raise
            time.sleep(int(retry))
        except (TimeoutError, URLError):
            if attempt:
                raise
            time.sleep(2)


def point(station, lat, lon, times, variables, source, depth=None):
    if not times or len(times) > 400 or not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ValueError("invalid grid point")
    if any(not isinstance(t, str) or len(t) < 10 for t in times) or times != sorted(set(times)):
        raise ValueError("invalid time axis")
    fields = []
    for key, unit, values in variables:
        if not unit or len(values) != len(times) or any(v is not None and (type(v) not in (float, int) or not math.isfinite(v)) for v in values):
            raise ValueError("invalid variable: " + key)
        fields.append(dict(key=key, unit=unit, values=values))
    if not fields:
        raise ValueError("no variables")
    return dict(site=station[0], requested=[station[1], station[2]], lat=lat, lon=lon, times=times, fields=fields, source=source, depthM=depth)


def meteo(base, stations, group, fields, *, summarize=None, **params):
    u = endpoint(base, latitude=",".join(str(s[1]) for s in stations), longitude=",".join(str(s[2]) for s in stations),
                 timezone="GMT", **{group: ",".join(fields)}, **params)
    payload = json.loads(read(u))
    items = payload if isinstance(payload, list) else [payload]
    if len(items) != len(stations):
        raise ValueError("incomplete station batch")
    series = []
    for station, item in zip(stations, items):
        values, units = item[group], item[group + "_units"]
        if abs(item["latitude"]-station[1]) > 1 or abs(item["longitude"]-station[2]) > 1 or item["utc_offset_seconds"] != 0:
            raise ValueError("station or time zone mismatch")
        times = values["time"]
        variables = [(f, units[f], values[f]) for f in fields]
        if summarize:
            times, variables = summarize(times, fields, values, units)
        series.append(point(station, item["latitude"], item["longitude"], times, variables, u))
    return {"series": series}


def gefs_percentiles(times, fields, values, units):
    # 31 members including control. With 31 sorted values, the linearly
    # interpolated 10th, 50th and 90th percentiles land on exact ranks.
    variables = []
    for field in fields:
        keys = [field] + [f"{field}_member{i:02}" for i in range(1, 31)]
        if any(len(values[k]) != len(times) or units[k] != units[field] for k in keys):
            raise ValueError("invalid GEFS member series")
        samples = zip(*(values[k] for k in keys))
        ordered = [sorted(day) if None not in day else None for day in samples]
        for percentile, rank in [(10, 3), (50, 15), (90, 27)]:
            variables.append((f"{field}_p{percentile}", units[field],
                              [day[rank] if day is not None else None for day in ordered]))
    if not any(v is not None for _, _, data in variables for v in data):
        raise ValueError("no complete GEFS ensemble")
    return times, variables


def available_periods(times, fields, values, units):
    if any(len(values[f]) != len(times) for f in fields):
        raise ValueError("invalid outlook time series")
    # The API pads requests beyond the model horizon with null periods.
    end = max((i + 1 for i in range(len(times)) if any(values[f][i] is not None for f in fields)), default=0)
    if end == 0:
        raise ValueError("empty climate outlook")
    return times[:end], [(f, units[f], values[f][:end]) for f in fields]


def outlook(period, model, days):
    return meteo("https://seasonal-api.open-meteo.com/v1/seasonal", STATIONS, period,
                 ["temperature_2m_anomaly", "precipitation_anomaly"], summarize=available_periods,
                 models=model, forecast_days=days)


def nasa(today):
    fields = ["T2M", "PRECTOTCORR", "WS2M", "ALLSKY_SFC_SW_DWN"]
    station = STATIONS[1]
    u = endpoint(POWER, parameters=",".join(fields), community="AG", longitude=station[2], latitude=station[1],
                 start=(today-timedelta(days=14)).strftime("%Y%m%d"), end=(today-timedelta(days=1)).strftime("%Y%m%d"),
                 format="JSON", **{"time-standard": "UTC"})
    item = json.loads(read(u))
    values = item["properties"]["parameter"]
    days = sorted(values[fields[0]])
    missing = item["header"]["fill_value"]
    lon, lat = item["geometry"]["coordinates"][:2]
    return {"series": [point(station, lat, lon, [datetime.strptime(d, "%Y%m%d").date().isoformat() for d in days],
                             [(f, item["parameters"][f]["units"], [None if values[f][d] == missing else values[f][d] for d in days]) for f in fields], u)]}


def erddap(dataset, field):
    variable = "sst" if field == "sst" else "chlor_a"
    query = variable + "[(last)][(0)]" + ("[(20):(21)]" if field == "sst" else "[(21):2:(20)]") + "[(110.9)" + (":" if field == "sst" else ":2:") + "(111.9)]"
    server = CW if field == "sst" else "https://coastwatch.noaa.gov/erddap/griddap/"
    u = server + dataset + ".csv?" + quote(query, safe="(),:")
    header, units, *rows = csv.reader(read(u).decode().splitlines())
    if header[-1] != variable or header[2:4] != ["latitude", "longitude"] or not rows:
        raise ValueError("unexpected ERDDAP subset")
    if units[-1] not in (("degree_C","degrees_C","°C") if field == "sst" else ("mg m^-3","mg m-3","mg/m3")):
        raise ValueError("unrecognised marine grid unit")
    day = rows[0][0]
    samples = []
    for d, _, lat, lon, raw in rows:
        val = float(raw)
        if d != day or math.isinf(val):
            raise ValueError("inconsistent ERDDAP grid")
        samples.append([float(lat), float(lon), None if math.isnan(val) else val])
    nearest = min(samples, key=lambda r: (r[0]-SEA[1])**2 + (r[1]-SEA[2])**2)
    return {"series": [point(SEA, nearest[0], nearest[1], [day], [(field, units[-1], [nearest[2]])], u)],
            "grid": {"time": day, "unit": units[-1], "points": samples}}


def copernicus(key):
    product, prefix, field = CMEMS[key]
    product_url = STAC + product + "/product.stac.json"
    entries = json.loads(read(product_url))["links"]
    candidates = [x["href"] for x in entries if x["rel"] in ("item", "child") and prefix in x["href"] and x["href"].endswith("/dataset.stac.json")]
    if not candidates:
        raise ValueError("no matching current product in STAC")
    item_url = urljoin(product_url, sorted(candidates)[-1])
    if not item_url.startswith(STAC + product + "/"):
        raise ValueError("unexpected catalogue host")
    dataset = json.loads(read(item_url))
    capabilities = dataset["assets"]["wmts"]["href"]
    if not capabilities.startswith(WMTS + "/"):
        raise ValueError("unexpected WMTS endpoint")
    xml = ET.fromstring(read(capabilities))
    layer = next(l for l in xml.findall(".//{*}Layer") if l.findtext("{*}Identifier").endswith("/"+field))
    dimensions = {d.findtext("{*}Identifier"): d.findtext("{*}Default") for d in layer.findall("{*}Dimension")}
    name = layer.findtext("{*}Identifier")
    style = layer.find("{*}Style").findtext("{*}Identifier")
    n = 256 * 2**7
    x = int((SEA[2]+180)/360*n)
    y = int((1-math.asinh(math.tan(math.radians(SEA[1])))/math.pi)/2*n)
    u = endpoint(WMTS, SERVICE="WMTS", REQUEST="GetFeatureInfo", VERSION="1.0.0", LAYER=name, STYLE=style, FORMAT="image/png",
                 TILEMATRIXSET="EPSG:3857", TILEMATRIX=7, TILEROW=y//256, TILECOL=x//256, I=x%256, J=y%256, INFOFORMAT="application/json", **dimensions)
    row = json.loads(read(u))["features"][0]["properties"]
    if row["variableId"] != field or not name.startswith(row["datasetId"]+"/") or abs(row["lat"]-SEA[1])>.3 or abs(row["lon"]-SEA[2])>.3:
        raise ValueError("unexpected WMTS feature")
    depth = abs(float(dimensions["elevation"])) if "elevation" in dimensions else None
    result = {"series": [point(SEA,row["lat"],row["lon"],[dimensions["time"]],[(field,row["units"],[row["value"]])],u,depth)]}
    result["raster"] = {"layer": name, "style": style, "time": dimensions["time"], **({"elevation": dimensions["elevation"]} if "elevation" in dimensions else {})}
    return result


def cyclones(today):
    start = (today-timedelta(days=30)).isoformat()
    u = endpoint("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH", eventlist="TC", fromdate=start, todate=today.isoformat())
    data = json.loads(read(u))
    if data["type"] != "FeatureCollection" or not isinstance(data["features"], list):
        raise ValueError("invalid event collection")
    events = {}
    for f in data["features"]:
        v = f["properties"]
        if v["eventtype"] != "TC" or v["todate"][:10] < start or v["fromdate"][:10] > today.isoformat():
            continue
        report = v["url"]["report"]
        if urlsplit(report).hostname != "www.gdacs.org":
            raise ValueError("invalid report URL")
        events[(v["eventid"],v["episodeid"])] = dict(name=str(v["name"]),start=v["fromdate"],end=v["todate"],url=report)
    return {"series": [], "events": sorted(events.values(),key=lambda v:v["end"],reverse=True)[:40],"catalogUrl":u}


def abis():
    # INCOIS publishes a dated NetCDF link, not a global alert API.
    page = "https://incois.gov.in/site/services/hab_products.jsp"
    html = read(page).decode()
    match = re.search(r"""<a\s+href=['"]([^'"]+\.nc)['"][^>]*>(?:(?!</a>).)*?Download Data\s*\((\d{1,2} [A-Za-z]{3} \d{4})\)""", html, re.I | re.S)
    if not match:
        raise ValueError("no dated ABIS product")
    href = urljoin(page, match[1])
    if urlsplit(href).hostname != "incois.gov.in":
        raise ValueError("unrecognised ABIS download host")
    day = datetime.strptime(match[2], "%d %b %Y").date().isoformat()
    return {"series": [], "events": [dict(name="INCOIS ABIS · India / Sri Lanka", start=day, end=day, url=href)], "catalogUrl":page}


def collect(today, previous=None):
    prior_heat = next((f for f in (previous or {}).get("feeds", []) if f["id"] == "heatwave"), {})
    return {
        "weather": lambda: meteo("https://api.open-meteo.com/v1/forecast",STATIONS,"hourly",
            ["temperature_2m","relative_humidity_2m","precipitation","wind_speed_10m","shortwave_radiation"], forecast_days=7,wind_speed_unit="ms"),
        "heatwave": lambda: climate_products.heatwave(prior_heat, SEA, point),
        "imerg": lambda: climate_products.imerg(read, STATIONS),
        "enso": lambda: climate_products.enso(read),
        "gefs": lambda: meteo("https://ensemble-api.open-meteo.com/v1/ensemble", STATIONS, "daily",
            ["temperature_2m_mean", "precipitation_sum"], summarize=gefs_percentiles, models="gfs_seamless", forecast_days=15),
        "ec46": lambda: outlook("weekly", "ecmwf_ec46", 46),
        "seas5": lambda: outlook("monthly", "ecmwf_seas5", 215),
        "marine": lambda: meteo(MARINE,[SEA],"hourly",["sea_surface_temperature","sea_level_height_msl","ocean_current_velocity"],forecast_days=3),
        "flood": lambda: meteo(FLOOD,[STATIONS[2]],"daily",["river_discharge"],forecast_days=7),
        "era5": lambda: meteo(ARCHIVE,STATIONS,"daily",["temperature_2m_mean","precipitation_sum","wind_speed_10m_max","shortwave_radiation_sum"],
            start_date=(today-timedelta(days=37)).isoformat(),end_date=(today-timedelta(days=7)).isoformat(),wind_speed_unit="ms",models="era5"),
        "power": lambda: nasa(today), "oisst": lambda: erddap(SST,"sst"),
        "oisst-final": lambda: erddap("ncdcOisst21Agg_LonPM180","sst"), "viirs": lambda: erddap(VIIRS,"chlor_a"),
        **{key: (lambda k=key: copernicus(k)) for key in CMEMS}, "cyclones": lambda: cyclones(today), "abis": abis,
    }


def sync(previous, adapters, now):
    old = {f["id"]: f for f in previous.get("feeds",[])}
    feeds = []
    successes = 0
    def run(pair):
        key, fn = pair
        try:
            content = fn()
            return key, content, None
        except Exception as exc:
            return key, None, type(exc).__name__ + (f" HTTP {exc.code}" if isinstance(exc,HTTPError) else "")
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for key, content, error in pool.map(run, adapters.items()):
            prior = old.get(key, {})
            # Record the first check in each 6-hour publication window. Reruns
            # within that window remain byte-identical when the source is unchanged.
            window = datetime.fromisoformat(now)
            window = window.replace(hour=window.hour-window.hour%6,minute=0,second=0,microsecond=0)
            prior_check = prior.get("checkedAt")
            checked = prior_check if prior_check and prior.get("state") == ("retained" if error and prior.get("retrievedAt") else "unavailable" if error else "ok") and datetime.fromisoformat(prior_check)>=window else now
            if error:
                print(f"{key}: refresh failed ({error})", flush=True)
                feeds.append({**prior,"id":key,"state":"retained" if prior.get("retrievedAt") else "unavailable","series":prior.get("series",[]),"checkedAt":checked,"error":error})
            else:
                successes += 1
                identical = prior.get("retrievedAt") and all(prior.get(k)==v for k,v in content.items())
                feeds.append({"id":key,"state":"ok","checkedAt":checked,"lastSuccessAt":checked,"retrievedAt":prior["retrievedAt"] if identical else now,**content})
                print(f"{key}: {'unchanged' if identical else 'updated'}", flush=True)
    if not successes:
        raise RuntimeError("All sources failed; keep previous snapshot")
    return previous if feeds == previous.get("feeds") else {"schemaVersion":1,"publishedAt":now,"feeds":feeds}


def validate(snapshot):
    expected = set(collect(date.today()))
    feeds = snapshot["feeds"]
    if snapshot["schemaVersion"] != 1 or {f["id"] for f in feeds} != expected or len(feeds) != len(expected):
        raise ValueError("incomplete source manifest")
    for f in feeds:
        datetime.fromisoformat(f["checkedAt"])
        if f["state"] not in ("ok", "retained", "unavailable"):
            raise ValueError("unknown source state")
        if f["state"] == "unavailable":
            continue
        if not f.get("retrievedAt") or (not any(k in f for k in ("events", "seasons", "frames")) and not f["series"]):
            raise ValueError("missing source provenance")
        for s in f["series"]:
            if not s["source"].startswith("https://"):
                raise ValueError("missing public source URL")
            point((s["site"], *s["requested"]), s["lat"], s["lon"], s["times"],
                  [(v["key"], v["unit"], v["values"]) for v in s["fields"]], s["source"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,default=BUNDLED)
    options = parser.parse_args()
    # Report missing runtime dependencies before attempting a partial publication.
    try:
        import h5py, fsspec, aiohttp, PIL
    except ImportError as exc:
        parser.exit(2, f"Missing {exc.name}; install scripts/requirements-environment.txt first.\n")
    out = options.output
    prior = out if out.exists() else BUNDLED
    previous = json.loads(prior.read_bytes()) if prior.exists() else {}
    now = datetime.now(timezone.utc)
    data = sync(previous,collect(now.date(), previous),now.isoformat(timespec="seconds"))
    validate(data)
    out.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w",dir=out.parent,delete=False,encoding="utf-8") as tmp:
        json.dump(data,tmp,ensure_ascii=False,separators=(",",":"),allow_nan=False)
        tmp.write("\n")
    os.replace(tmp.name,out)


if __name__ == "__main__":
    main()
