// src/components/LiveChart.tsx
import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LiveChartRef {
  setHistoricalData: (data: CandleData[]) => void;
  updateTick: (tick: Partial<CandleData> & { close: number }) => void;
}

interface LiveChartProps {
  symbol: string;
  height?: number | string;
  theme?: 'dark' | 'light';
}

const buildChartHtml = (theme: 'dark' | 'light') => {
  const bg = theme === 'dark' ? '#18181b' : '#ffffff';
  const text = theme === 'dark' ? '#a1a1aa' : '#3f3f46';
  const grid = theme === 'dark' ? '#27272a' : '#e4e4e7';
  const upColor = '#10b981';
  const downColor = '#ef4444';

  return `<!DOCTYPE html>
<html style="margin:0;padding:0;background:${bg};overflow:hidden">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #chart {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${bg};
      font-family: Inter, system-ui, sans-serif;
    }
  </style>
</head>
<body>
  <div id="chart"></div>

  <script src="https://unpkg.com/lightweight-charts@5.0.5/dist/lightweight-charts.standalone.production.js"></script>
  <script>
    (function () {
      var chartContainer = document.getElementById('chart');

      var chart = LightweightCharts.createChart(chartContainer, {
        layout: {
          background: { type: 'solid', color: '${bg}' },
          textColor: '${text}',
        },
        grid: {
          vertLines: { color: '${grid}' },
          horzLines: { color: '${grid}' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: { mode: 0 },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
        width: window.innerWidth,
        height: window.innerHeight,
      });

      var series = chart.addSeries(LightweightCharts.CandlestickSeries, {
        upColor: '${upColor}',
        downColor: '${downColor}',
        borderVisible: false,
        wickUpColor: '${upColor}',
        wickDownColor: '${downColor}',
      });

      var currentCandle = null;

      function safeParse(data) {
        try {
          return JSON.parse(data);
        } catch (e) {
          return null;
        }
      }

      function applyTick(tick) {
        if (!tick || isNaN(tick.close)) return;

        var updated;
        if (!currentCandle || tick.time > currentCandle.time) {
          updated = Object.assign({}, tick);
        } else {
          updated = {
            time: currentCandle.time,
            open: currentCandle.open,
            high: Math.max(currentCandle.high, tick.high != null ? tick.high : tick.close),
            low: Math.min(currentCandle.low, tick.low != null ? tick.low : tick.close),
            close: tick.close,
          };
        }

        series.update(updated);
        currentCandle = updated;
      }

      window.addEventListener('message', function (event) {
        var msg = safeParse(event.data);
        if (!msg) return;

        if (msg.type === 'SET_HISTORICAL') {
          if (Array.isArray(msg.data) && msg.data.length > 0) {
            series.setData(msg.data);
            currentCandle = msg.data[msg.data.length - 1];
            chart.timeScale().fitContent();
          }
        }

        if (msg.type === 'UPDATE_TICK') {
          applyTick(msg.tick);
        }

        if (msg.type === 'APPLY_THEME') {
          chart.applyOptions({
            layout: {
              background: { type: 'solid', color: msg.bg },
              textColor: msg.text,
            },
            grid: {
              vertLines: { color: msg.grid },
              horzLines: { color: msg.grid },
            },
          });
        }
      });

      chart.subscribeCrosshairMove(function (param) {
        if (!param || !param.seriesData) return;
        var candle = param.seriesData.get(series);
        if (!candle) return;

        window.parent.postMessage(JSON.stringify({
          type: 'CROSSHAIR',
          data: candle
        }), '*');
      });

      var resizeObserver = new ResizeObserver(function () {
        chart.applyOptions({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      });

      resizeObserver.observe(document.documentElement);

      window.parent.postMessage(JSON.stringify({ type: 'CHART_READY' }), '*');
    })();
  </script>
</body>
</html>`;
};

const LiveChart = forwardRef<LiveChartRef, LiveChartProps>(
  ({ symbol, height = '100%', theme = 'dark' }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const queueRef = useRef<string[]>([]);
    const readyRef = useRef(false);
    const blobUrlRef = useRef<string | null>(null);

    const postToChart = useCallback((message: object) => {
      const payload = JSON.stringify(message);

      if (readyRef.current && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(payload, '*');
      } else {
        queueRef.current.push(payload);
      }
    }, []);

    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'CHART_READY') {
            readyRef.current = true;

            if (iframeRef.current?.contentWindow) {
              queueRef.current.forEach((queued) => {
                iframeRef.current?.contentWindow?.postMessage(queued, '*');
              });
            }

            queueRef.current = [];
          }
        } catch {
          // ignore non-json messages
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, []);

    useEffect(() => {
      readyRef.current = false;

      const html = buildChartHtml(theme);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }

      blobUrlRef.current = url;

      if (iframeRef.current) {
        iframeRef.current.src = url;
      }

      return () => {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    }, [theme]);

    useImperativeHandle(ref, () => ({
      setHistoricalData: (data: CandleData[]) => {
        postToChart({ type: 'SET_HISTORICAL', data });
      },
      updateTick: (tick) => {
        postToChart({ type: 'UPDATE_TICK', tick });
      },
    }));

    return (
      <div
        style={{
          width: '100%',
          height,
          position: 'relative',
          overflow: 'hidden',
          touchAction: 'none',
          borderRadius: 16,
        }}
      >
        <iframe
          ref={iframeRef}
          title={`chart-${symbol}`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            background: theme === 'dark' ? '#18181b' : '#ffffff',
          }}
          sandbox="allow-scripts allow-same-origin"
          scrolling="no"
        />
      </div>
    );
  }
);

LiveChart.displayName = 'LiveChart';

export default LiveChart;