import { Request, Response, NextFunction } from 'express';
import { query } from '../db/index';
import { logger } from '../utils/logger';

export const requireKyc = async (req: any, res: any, next: NextFunction) => {
  try {
    const { rows } = await query("SELECT kyc_status, role FROM users WHERE id = $1", [req.user.id]);
    const user = rows[0];
    
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.role === 'admin') return next(); // Admins bypass KYC for testing

    if (user.kyc_status !== 'approved') {
      return res.status(403).json({ 
        error: 'KYC verification required',
        kycStatus: user.kyc_status,
        message: 'Please complete your KYC verification before placing trades.',
        requires_kyc: true // Frontend flag
      });
    }
    next();
  } catch (e) {
    logger.error('[KYC Middleware] Error:', e);
    res.status(500).json({ error: 'Internal server error during KYC check' });
  }
};