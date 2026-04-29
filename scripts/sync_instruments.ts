/**
 * scripts/sync_instruments.ts
 * Usage: npx tsx scripts/sync_instruments.ts
 */

import https from 'https';
import zlib from 'zlib';
import csv from 'csv-parser';
import { pool } from '../src/db/index.js';

const UPSTOX_FILES = [
  'https://assets.upstox.com/market-quote/instruments/exchange/NSE.csv.gz',
  'https://assets.upstox.com/market-quote/instruments/exchange/BSE.csv.gz',
  'https://assets.upstox.com/market-quote/instruments/exchange/NFO.csv.gz',
];

const BATCH_SIZE = 500; // 500 rows × 6 cols = 3000 PG params (safe)

interface UpstoxRow {
  instrument_key: string;
  exchange_token: string;
  tradingsymbol: string;
  name: string;
  exchange: string;
  instrument_type: string;
  [key: string]: string;
}

async function insertChunk(chunk: UpstoxRow[]): Promise<void> {
  if (chunk.length === 0) return;

  const values: unknown[] = [];
  const placeholders = chunk
    .map((row, i) => {
      const o = i * 6;
      values.push(
        row.instrument_key,
        row.exchange_token,
        row.tradingsymbol,
        row.name || row.tradingsymbol,
        row.exchange,
        row.instrument_type
      );
      return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6})`;
    })
    .join(',');

  await pool.query(
    `INSERT INTO instruments
       (instrument_key, exchange_token, tradingsymbol, name, exchange, instrument_type)
     VALUES ${placeholders}
     ON CONFLICT (instrument_key) DO UPDATE SET
       tradingsymbol   = EXCLUDED.tradingsymbol,
       name            = EXCLUDED.name,
       exchange        = EXCLUDED.exchange,
       instrument_type = EXCLUDED.instrument_type,
       last_updated    = CURRENT_TIMESTAMP`,
    values
  );
}

export async function syncUpstoxInstruments(): Promise<void> {
  console.log('[Sync] ▶ Starting Upstox Instrument Sync...');

  for (const url of UPSTOX_FILES) {
    console.log(`[Sync] Downloading: ${url}`);

    await new Promise<void>((resolve, reject) => {
      let batch: UpstoxRow[] = [];
      let totalUpserted = 0;
      let pendingWrites = 0;
      let streamEnded = false;

      const flush = async (stream: NodeJS.ReadableStream): Promise<void> => {
        if (batch.length === 0) return;
        const toInsert = batch.splice(0, batch.length);
        pendingWrites++;
        stream.pause();
        try {
          await insertChunk(toInsert);
          totalUpserted += toInsert.length;
        } catch (err) {
          console.error('[Sync] Batch insert error:', err);
        } finally {
          pendingWrites--;
          stream.resume();
          if (streamEnded && pendingWrites === 0) {
            console.log(`[Sync] ✔ Done: ${url}  (${totalUpserted} rows)`);
            resolve();
          }
        }
      };

      https
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode} for ${url}`));
            return;
          }

          const csvStream = response.pipe(zlib.createGunzip()).pipe(csv());

          csvStream
            .on('data', async (row: UpstoxRow) => {
              batch.push(row);
              if (batch.length >= BATCH_SIZE) await flush(csvStream);
            })
            .on('end', async () => {
              streamEnded = true;
              if (batch.length > 0) await flush(csvStream);
              if (pendingWrites === 0) {
                console.log(`[Sync] ✔ Done: ${url}  (${totalUpserted} rows)`);
                resolve();
              }
            })
            .on('error', reject);

          response.on('error', reject);
        })
        .on('error', reject);
    });
  }

  console.log('[Sync] ✅ Upstox Instrument Sync Complete!');
}

// CLI entry-point
if (
  process.argv[1]?.endsWith('sync_instruments.ts') ||
  process.argv[1]?.endsWith('sync_instruments.js')
) {
  syncUpstoxInstruments()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Sync] Fatal:', err);
      process.exit(1);
    });
}