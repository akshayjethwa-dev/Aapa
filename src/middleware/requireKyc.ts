// src/middleware/requireKyc.ts  — UPDATED
// ─────────────────────────────────────────────────────────────────────────────
// requireKyc           → gates any trade behind approved KYC
// requireFOEligibility → gates F&O routes behind segments_enabled containing "FO"
//
// Usage in your route files:
//   router.post('/order', authenticate, requireKyc, placeOrderHandler);
//   router.post('/fo/order', authenticate, requireKyc, requireFOEligibility, foOrderHandler);
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { query } from '../db/index';
import { logger } from '../utils/logger';

// ─── requireKyc ──────────────────────────────────────────────────────────────
export const requireKyc = async (req: any, res: any, next: NextFunction) => {
  try {
    const { rows } = await query(
      'SELECT kyc_status, role, risk_profile, segments_enabled FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = rows[0];

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Admins bypass KYC check (for internal testing)
    if (user.role === 'admin') {
      req.userSegments    = ['EQUITY', 'FO', 'COMMODITY', 'CURRENCY'];
      req.userRiskProfile = 'aggressive';
      return next();
    }

    if (user.kyc_status !== 'approved') {
      return res.status(403).json({
        error: 'KYC verification required',
        kycStatus: user.kyc_status,
        message: 'Please complete your KYC verification before placing trades.',
        requires_kyc: true,
      });
    }

    // Attach to request so downstream middleware/handlers can use it
    req.userSegments    = Array.isArray(user.segments_enabled) ? user.segments_enabled : ['EQUITY'];
    req.userRiskProfile = user.risk_profile;

    next();
  } catch (e) {
    logger.error('[KYC Middleware] Error:', e);
    res.status(500).json({ error: 'Internal server error during KYC check' });
  }
};

// ─── requireFOEligibility ─────────────────────────────────────────────────────
// Must run AFTER requireKyc (depends on req.userSegments being set)
export const requireFOEligibility = async (req: any, res: any, next: NextFunction) => {
  try {
    const segments: string[] = req.userSegments || [];

    if (!segments.includes('FO')) {
      return res.status(403).json({
        error: 'F&O segment not enabled',
        message:
          'Your current risk profile does not allow F&O trading. Please retake the risk questionnaire and select an aggressive profile.',
        requires_risk_assessment: true,
      });
    }

    next();
  } catch (e) {
    logger.error('[FO Eligibility Middleware] Error:', e);
    res.status(500).json({ error: 'Internal server error during F&O eligibility check' });
  }
};