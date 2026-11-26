"""Offline publication regressions. Network access is not required."""
import copy
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from scripts import sync_environment as env


class EnvironmentTest(unittest.TestCase):
    def test_missing_and_zero_are_distinct(self):
        s = env.point(("offshore", 20, 110), 20, 110, ["2026-01-01", "2026-01-02"],
                      [("sst", "°C", [0, None])], "https://example.org/test")
        self.assertEqual(s["fields"][0]["values"], [0, None])
        with self.assertRaises(ValueError):
            env.point(("x", 20, 110), 20, 110, ["2026-01-01"], [("a", "m", [float("nan")])], "url")

    def test_partial_failure_keeps_a_last_good_batch_and_retry_is_idempotent(self):
        def good():
            return {"series": [], "events": []}

        def failed():
            raise TimeoutError()

        adapters = {"a": good, "b": good}
        base = env.sync({}, adapters, "2026-11-26T00:01:00+00:00")
        retry = env.sync(base, adapters, "2026-11-26T01:00:00+00:00")
        self.assertEqual(retry, base)
        stale = env.sync(base, {**adapters,"a": failed}, "2026-11-26T06:01:00+00:00")
        self.assertEqual(stale["feeds"][0]["state"], "retained")
        self.assertEqual(stale["feeds"][0]["retrievedAt"], base["publishedAt"])
        self.assertEqual(stale["feeds"][0]["lastSuccessAt"], base["publishedAt"])
        fixed = env.sync(stale, adapters,"2026-11-26T06:04:00+00:00")
        self.assertEqual(fixed["feeds"][0]["state"],"ok")
        self.assertEqual(fixed["feeds"][0]["lastSuccessAt"],"2026-11-26T06:04:00+00:00")
        with self.assertRaises(RuntimeError):
            env.sync(base, {"a": failed}, "2026-11-26T07:01:00+00:00")

    def test_satellite_nodata_pixel_is_never_silently_interpolated(self):
        csv = b"time,altitude,latitude,longitude,chlor_a\nUTC,m,degrees_north,degrees_east,mg m^-3\n2026-11-16T12:00:00Z,0,20.5,111.5,NaN\n2026-11-16T12:00:00Z,0,20.5,111.6,0.7\n"
        with patch.object(env,"read",return_value=csv):
            data = env.erddap(env.VIIRS,"chlor_a")
        self.assertIsNone(data["series"][0]["fields"][0]["values"][0])
        self.assertEqual(data["grid"]["points"][1][2],0.7)

    def test_meteo_rejects_wrong_batch_and_misaligned_series(self):
        with patch.object(env,"read",return_value=b'[]'), self.assertRaises(ValueError):
            env.meteo(env.WEATHER,env.STATIONS,"hourly",["temperature_2m"])
        with self.assertRaises(ValueError):
            env.point(env.SEA,20,111,["2026-11-25"],[("sst","°C",[])],"url")

    def test_publication_validation_rejects_incomplete_snapshot(self):
        snapshot=json.loads(env.BUNDLED.read_bytes())
        env.validate(snapshot)
        broken=copy.deepcopy(snapshot)
        broken["feeds"].pop()
        with self.assertRaises(ValueError):
            env.validate(broken)
