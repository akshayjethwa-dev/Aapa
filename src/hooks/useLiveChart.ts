// src/hooks/useLiveChart.ts
import { useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../api/client';
import type { LiveChartRef, CandleData } from '../components/LiveChart';

type Timeframe = '1m' | '5m' | '15m' | '1h' | '1D';

interface UseLiveChartOptions {
  instrumentKey: string;
  timeframe?: Timeframe;
  chartRef: React.RefObject<LiveChartRef | null>;
  /** Max ticks sent to chart per second. Default: 2 */
  tickRateLimit?: number;
  onPriceUpdate?: (ltp: number) => void;
  onLoadingChange?: (loading: boolean) => void;
  onError?: (msg: string | null) => void;
}

const BUCKET_SECONDS: Record<Timeframe, number> = {
  '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1D': 86400,
};

function aggregateCandles(candles: CandleData[], bucketSecs: number): CandleData[] {
  if (bucketSecs === 60 || bucketSecs === 86400) return candles;
  const result: CandleData[] = [];
  let cur: CandleData | null = null;
  for (const c of candles) {
    const t = c.time as number;
    const aligned = t - (t % bucketSecs);
    if (!cur || (cur.time as number) !== aligned) {
      if (cur) result.push(cur);
      cur = { time: aligned, open: c.open, high: c.high, low: c.low, close: c.close };
    } else {
      cur.high  = Math.max(cur.high, c.high);
      cur.low   = Math.min(cur.low,  c.low);
      cur.close = c.close;
    }
  }
  if (cur) result.push(cur);
  return result;
}

export function useLiveChart({
  instrumentKey,
  timeframe = '1m',
  chartRef,
  tickRateLimit = 2,
  onPriceUpdate,
  onLoadingChange,
  onError,
}: UseLiveChartOptions) {
  // Stable callback refs — prevent effect re-runs when callbacks change identity
  const onPriceUpdateRef = useRef(onPriceUpdate);
  const onLoadingRef     = useRef(onLoadingChange);
  const onErrorRef       = useRef(onError);
  useEffect(() => { onPriceUpdateRef.current = onPriceUpdate;  }, [onPriceUpdate]);
  useEffect(() => { onLoadingRef.current     = onLoadingChange; }, [onLoadingChange]);
  useEffect(() => { onErrorRef.current       = onError;         }, [onError]);

  const lastTickSentRef = useRef<number>(0);
  const minIntervalMs   = tickRateLimit > 0 ? 1000 / tickRateLimit : 0;

  const sendTick = useCallback(
    (tick: CandleData) => {
      if (minIntervalMs === 0) {
        chartRef.current?.updateTick(tick);
        return;
      }
      const now = Date.now();
      if (now - lastTickSentRef.current >= minIntervalMs) {
        lastTickSentRef.current = now;
        chartRef.current?.updateTick(tick);
      }
    },
    [chartRef, minIntervalMs]
  );

  useEffect(() => {
    if (!instrumentKey) return;

    let ws: WebSocket | null = null;
    let destroyed = false;
    const bucketSecs    = BUCKET_SECONDS[timeframe];
    const fetchInterval = timeframe === '1D' ? 'day' : '1minute';

    const init = async () => {
      onLoadingRef.current?.(true);
      onErrorRef.current?.(null);

      // ── 1. Historical candles ──────────────────────────────────────────────
      try {
        const res = await apiClient.get(
          `/api/market/history?instrument=${encodeURIComponent(instrumentKey)}&interval=${fetchInterval}`
        );
        if (destroyed) return;

        const raw: any[] =
          res.data?.data?.candles ||
          res.data?.candles ||
          res.data ||
          [];

        if (Array.isArray(raw) && raw.length > 0) {
          const mapped: CandleData[] = raw
            .map((c: any): CandleData => ({
              time:  Math.floor(new Date(c.timestamp || c.time || c[0]).getTime() / 1000),
              open:  Number(c.open  ?? c[1]),
              high:  Number(c.high  ?? c[2]),
              low:   Number(c.low   ?? c[3]),
              close: Number(c.close ?? c[4]),
            }))
            .filter((d) => Number.isFinite(d.time) && Number.isFinite(d.close))
            .sort((a, b) => (a.time as number) - (b.time as number))
            // deduplicate consecutive timestamps
            .filter((v, i, arr) => i === 0 || v.time !== arr[i - 1].time);

          chartRef.current?.setHistoricalData(aggregateCandles(mapped, bucketSecs));
        }
      } catch {
        if (!destroyed) onErrorRef.current?.('Failed to load historical data');
      }

      onLoadingRef.current?.(false);
      if (destroyed) return;

      // ── 2. WebSocket live ticks ────────────────────────────────────────────
      const wsBase =
        (import.meta as any).env?.VITE_WS_URL?.trim() ||
        `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

      ws = new WebSocket(`${wsBase}/market-data`);

      ws.onmessage = (event: MessageEvent) => {
        if (destroyed) return;
        try {
          const tick = JSON.parse(event.data as string);

          const tickKey = tick.instrumentKey || tick.symbol || "";
            const isMatch =
              tickKey === instrumentKey ||
              tickKey === instrumentKey.split("|")[1] || // match ISIN part only
              tick.symbol === instrumentKey;
            if (!isMatch || !tick.ltp) return;

          const tickMs   = (tick.timestamp || tick.exchange_timestamp || Date.now()) as number;
          const tickSecs = Math.floor(tickMs / 1000);

          let alignedTime: number;
          if (timeframe === '1D') {
            // Align to IST midnight (UTC+5:30 = +19800 seconds offset)
            const ist = tickSecs + 19800;
            alignedTime = ist - (ist % 86400) - 19800;
          } else {
            alignedTime = tickSecs - (tickSecs % bucketSecs);
          }

          sendTick({
            time:  alignedTime,
            open:  Number(tick.open  ?? tick.ltp),
            high:  Number(tick.high  ?? tick.ltp),
            low:   Number(tick.low   ?? tick.ltp),
            close: Number(tick.ltp),
          });

          onPriceUpdateRef.current?.(Number(tick.ltp));
        } catch {
          // Silently ignore malformed WebSocket frames
        }
      };

      ws.onerror = () => {
        if (!destroyed) onErrorRef.current?.('WebSocket error — retrying…');
      };
    };

    init();

    // ── Cleanup: close WS on symbol/timeframe change or unmount ───────────
    return () => {
      destroyed = true;
      ws?.close();
    };
  }, [instrumentKey, timeframe, sendTick, chartRef]);
}