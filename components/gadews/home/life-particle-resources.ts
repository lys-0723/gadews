/** Same-origin visual reads have a byte ceiling, deadline and caller-owned cancellation. */
export async function readBoundedLifeResource(path: string, limit: number, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<Uint8Array> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const timeout = setTimeout(abort, 8000);
  try {
    const response = await fetcher(path, { signal: controller.signal, credentials: "same-origin" });
    if (!response.ok) throw new Error("Life resource unavailable");
    if (Number(response.headers.get("content-length")) > limit) { await response.body?.cancel(); throw new Error("Life resource too large"); }
    if (!response.body) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > limit) throw new Error("Life resource too large");
      return bytes;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) { await reader.cancel(); throw new Error("Life resource too large"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally { clearTimeout(timeout); signal.removeEventListener("abort", abort); }
}
