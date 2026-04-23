// src/validation/schemas.ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number').optional().nullable(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
});

export const loginSchema = z.object({
  login: z.string().min(1, 'Login identifier (email or mobile) is required'),
  password: z.string().min(1, 'Password is required'),
});

export const placeOrderSchema = z.object({
  symbol:        z.string().min(1, 'Trading symbol is required'),
  type:          z.enum(['BUY', 'SELL', 'buy', 'sell']),
  order_type:    z.enum(['MARKET', 'LIMIT', 'SL', 'SL-M', 'market', 'limit', 'sl', 'sl-m']),
  validity:      z.enum(['DAY', 'IOC']).optional().default('DAY'),   // ← NEW
  quantity:      z.coerce.number().int().positive('Quantity must be greater than zero'),
  price:         z.coerce.number().nonnegative('Price cannot be negative').optional().default(0),
  trigger_price: z.coerce.number().nonnegative('Trigger price cannot be negative').optional().default(0), // ← NEW
  product:       z.string().optional().default('I'),
  broker:        z.enum(['upstox', 'angelone']).optional().default('upstox'),
  expiry:        z.string().optional(),
  strike:        z.coerce.number().optional(),
  optionType:    z.enum(['CE', 'PE', 'ce', 'pe']).optional(),
}).superRefine((data, ctx) => {
  const ot = data.order_type.toUpperCase();

  // LIMIT and SL require price > 0
  if (['LIMIT', 'SL'].includes(ot) && (data.price ?? 0) <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Price must be greater than 0 for Limit/SL orders',
      path: ['price'],
    });
  }

  // SL and SL-M require trigger_price > 0
  if (['SL', 'SL-M'].includes(ot) && (data.trigger_price ?? 0) <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Trigger price must be greater than 0 for SL/SL-M orders',
      path: ['trigger_price'],
    });
  }
});

export const angelOneLoginSchema = z.object({
  clientCode: z.string().min(1, 'Client code is required'),
  password:   z.string().min(1, 'Password is required'),
  totp:       z.string().min(1, 'TOTP is required'),
});

export const upstoxSaveTokenSchema = z.object({
  access_token:  z.string().min(1, 'Access token is required'),
  refresh_token: z.string().optional(),
});

export const adminCreateUserSchema = registerSchema.extend({
  role: z.enum(['user', 'admin']).optional().default('user'),
});

export const whitelistSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
});