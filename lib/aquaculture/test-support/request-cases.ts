// Shared invalid inputs keep parser and handler side-effect checks in sync.
export const invalidBodies = ["{", "null", "[]", "123", '"x"', '{"deviceKey":123}', '{"deviceKey":"../upstream"}', '{"upstreamDeviceId":"external"}', '{"startDate":"2026-02-30"}', '{"startDate":true}', '{"startDate":"2026-10-29","endDate":"2026-10-28"}'];
export const invalidLimits = ["0", "1001", "20abc", "1.5", "1e2", "+1", " "];
export const invalidQueries = ["limit=1&limit=2", "from=2026-01-01&from=2026-02-01", "unknown=x", "from=2026-02-30", "from=2026-13-01", "from=2026-10-28T12:00:00", "from=2026-10-28T24:00:00Z", "from=2026-10-29&to=2026-10-28"];
