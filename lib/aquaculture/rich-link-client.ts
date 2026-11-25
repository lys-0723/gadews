import { createRichLinkSignature } from "./rich-link-signature";
import type {
  RichLinkApiEnvelope,
  RichLinkControlItem,
  RichLinkHistoryRow,
  RichLinkSettings,
} from "./types";

export interface RichLinkHistoryQuery {
  page: number;
  limit: number;
  startTime?: string;
  endTime?: string;
}

type FetchImplementation = typeof fetch;

export class RichLinkApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly upstreamCode?: number
  ) {
    super(message);
    this.name = "RichLinkApiError";
  }
}

export class RichLinkClient {
  constructor(
    private readonly settings: RichLinkSettings,
    private readonly fetchImplementation: FetchImplementation = fetch
  ) {}

  async getControlItems(deviceId: string): Promise<RichLinkControlItem[]> {
    const response = await this.request<RichLinkControlItem[]>(
      `/api/iot/controlItem/queryWithOut/${encodeURIComponent(deviceId)}`,
      {},
      { appId: this.settings.appId }
    );
    return response.data;
  }

  async getHistory(
    deviceId: string,
    query: RichLinkHistoryQuery
  ): Promise<RichLinkApiEnvelope<RichLinkHistoryRow[]>> {
    const queryParams: Record<string, string> = {
      page: String(query.page),
      limit: String(query.limit),
    };
    const signatureParams: Record<string, string | number> = {
      appId: this.settings.appId,
      page: query.page,
      limit: query.limit,
    };

    if (query.startTime) {
      queryParams.startTime = query.startTime;
      signatureParams.startTime = query.startTime;
    }
    if (query.endTime) {
      queryParams.endTime = query.endTime;
      signatureParams.endTime = query.endTime;
    }

    return this.request<RichLinkHistoryRow[]>(
      `/api/iot/controlLog/queryWithOut/${encodeURIComponent(deviceId)}`,
      queryParams,
      signatureParams
    );
  }

  private async request<T>(
    path: string,
    query: Record<string, string>,
    signatureParams: Record<string, string | number>
  ): Promise<RichLinkApiEnvelope<T>> {
    const url = new URL(`${this.settings.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.settings.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImplementation(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          appId: this.settings.appId,
          sign: createRichLinkSignature(
            signatureParams,
            this.settings.publicKey
          ),
        },
        signal: controller.signal,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Rich-Link request error";
      throw new RichLinkApiError(`Rich-Link request failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }

    const body = await response.text();
    if (!response.ok) {
      throw new RichLinkApiError(
        `Rich-Link returned HTTP ${response.status}`,
        response.status
      );
    }

    let parsed: RichLinkApiEnvelope<T>;
    try {
      parsed = JSON.parse(body) as RichLinkApiEnvelope<T>;
    } catch {
      throw new RichLinkApiError("Rich-Link returned a non-JSON response");
    }

    if (parsed.code !== 200) {
      throw new RichLinkApiError(
        parsed.msg || `Rich-Link returned code ${parsed.code}`,
        response.status,
        parsed.code
      );
    }
    if (!Array.isArray(parsed.data)) {
      throw new RichLinkApiError("Rich-Link response data is not an array");
    }

    return parsed;
  }
}
