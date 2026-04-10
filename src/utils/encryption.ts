import crypto from 'crypto';
import { logger } from './logger'; // Using the logger we created in the last step

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    logger.error('ENCRYPTION_KEY is missing from environment variables');
    throw new Error('ENCRYPTION_KEY is missing');
  }
  return Buffer.from(keyHex, 'hex');
}

export function encrypt(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  
  try {
    const KEY = getKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Store as: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    logger.error("Encryption failed", error);
    throw new Error("Failed to encrypt token");
  }
}

export function decrypt(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  
  // Optional: Safety fallback if you have unencrypted tokens already in your DB during transition
  if (!ciphertext.includes(':')) return ciphertext; 
  
  try {
    const KEY = getKey();
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
    
    if (!ivHex || !authTagHex || !encrypted) {
        throw new Error("Invalid ciphertext format");
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error("Decryption failed", error);
    throw new Error("Failed to decrypt token");
  }
}