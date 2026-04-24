import https from 'https';
import zlib from 'zlib';
import csv from 'csv-parser';
import { pool } from '../src/db/index.js'; // Adjust path if needed

const UPSTOX_FILES = [
  'https://assets.upstox.com/market-quote/instruments/exchange/NSE.csv.gz',
  'https://assets.upstox.com/market-quote/instruments/exchange/BSE.csv.gz',
  'https://assets.upstox.com/market-quote/instruments/exchange/NFO.csv.gz', // F&O
];

async function insertChunk(chunk: any[]) {
  if (chunk.length === 0) return;

  // Build a parameterized UPSERT query for bulk insert
  const values: any[] = [];
  const placeholders = chunk.map((row, i) => {
    const offset = i * 6;
    values.push(
      row.instrument_key,
      row.exchange_token,
      row.tradingsymbol,
      row.name || row.tradingsymbol,
      row.exchange,
      row.instrument_type
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
  }).join(', ');

  const query = `
    INSERT INTO instruments (instrument_key, exchange_token, tradingsymbol, name, exchange, instrument_type)
    VALUES ${placeholders}
    ON CONFLICT (instrument_key) 
    DO UPDATE SET 
      tradingsymbol = EXCLUDED.tradingsymbol,
      name = EXCLUDED.name,
      last_updated = CURRENT_TIMESTAMP;
  `;

  await pool.query(query, values);
}

export async function syncUpstoxInstruments() {
  console.log('[Sync] Starting Upstox Instrument Sync...');

  for (const url of UPSTOX_FILES) {
    console.log(`[Sync] Downloading and processing: ${url}`);
    
    await new Promise<void>((resolve, reject) => {
      let chunk: any[] = [];
      let totalInserted = 0;

      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
          return;
        }

        response
          .pipe(zlib.createGunzip()) // Unzip stream
          .pipe(csv())               // Parse CSV stream
          .on('data', async (row) => {
            chunk.push(row);

            // Insert in batches of 1000 to respect Postgres parameter limits
            if (chunk.length >= 1000) {
              const currentChunk = [...chunk];
              chunk = []; // Reset chunk
              try {
                await insertChunk(currentChunk);
                totalInserted += currentChunk.length;
              } catch (err) {
                console.error('[Sync] Batch insert error:', err);
              }
            }
          })
          .on('end', async () => {
            // Insert remaining rows
            if (chunk.length > 0) {
              await insertChunk(chunk);
              totalInserted += chunk.length;
            }
            console.log(`[Sync] Finished processing ${url}. Inserted/Updated: ${totalInserted}`);
            resolve();
          })
          .on('error', reject);
      });
    });
  }
  
  console.log('[Sync] Upstox Instrument Sync Complete!');
}