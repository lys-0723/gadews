import assert from "node:assert/strict";
import test from "node:test";
import { getRichLinkSettings } from "./config";

const baseEnvironment = {
  RICH_LINK_BASE_URL: "http://device.example.test",
  RICH_LINK_ALLOW_INSECURE_HTTP: "true",
  RICH_LINK_APP_ID: "Research:Example",
  RICH_LINK_PUBLIC_KEY: "test-public-key",
  RICH_LINK_DEVICE_ID: "device-1",
  RICH_LINK_DEVICE_KEY: "pond-a-sensor",
  RICH_LINK_SITE_ID: "site-a",
  RICH_LINK_POND_ID: "pond-a",
};

test("loads a single device from environment variables", () => {
  const settings = getRichLinkSettings(baseEnvironment);
  assert.equal(settings.pollIntervalSeconds, 180);
  assert.deepEqual(settings.devices[0], {
    key: "pond-a-sensor",
    upstreamDeviceId: "device-1",
    siteId: "site-a",
    pondId: "pond-a",
    name: "Rich-Link primary device",
    enabled: true,
  });
});

test("rejects HTTP unless it is explicitly allowed", () => {
  assert.throws(
    () =>
      getRichLinkSettings({
        ...baseEnvironment,
        RICH_LINK_ALLOW_INSECURE_HTTP: "false",
      }),
    /uses HTTP/
  );
});

test("supports multiple named devices without exposing arbitrary device IDs", () => {
  const settings = getRichLinkSettings({
    ...baseEnvironment,
    RICH_LINK_DEVICES_JSON: JSON.stringify([
      {
        key: "pond-a",
        upstreamDeviceId: "external-a",
        siteId: "site-a",
        pondId: "pond-a",
        name: "Pond A",
      },
      {
        key: "pond-b",
        upstreamDeviceId: "external-b",
        siteId: "site-a",
        pondId: "pond-b",
        name: "Pond B",
      },
    ]),
  });
  assert.equal(settings.devices.length, 2);
});
