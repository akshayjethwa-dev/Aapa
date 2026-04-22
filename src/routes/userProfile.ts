// src/routes/userProfile.ts
// ─────────────────────────────────────────────────────────────────────────────
// Endpoints:
//   GET   /api/user/profile           → full user profile with computed completeness
//   PATCH /api/user/risk-profile      → save risk questionnaire result
//
// Wire in server.ts:
//   import userProfileRouter from './routes/userProfile';
//   app.use('/api/user', authenticate, userProfileRouter);
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Response } from 'express';
import { query } from '../db/index';
import { logger } from '../utils/logger';

const router = Router();

// ─── GET /api/user/profile ────────────────────────────────────────────────────
router.get('/profile', async (req: any, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT
         id,
         email,
         role,
         balance,
         is_uptox_connected,
         has_upstox_account,
         onboarding_step,
         is_onboarding_complete,
         first_login_completed_at,
         kyc_status,
         risk_profile,
         segments_enabled
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const u = rows[0];

    // Ensure segments_enabled is always a proper array
    const segments = Array.isArray(u.segments_enabled)
      ? u.segments_enabled
      : ['EQUITY'];

    return res.json({
      ...u,
      segments_enabled: segments,
      profile_completeness: deriveProfileCompleteness(u),
    });
  } catch (e) {
    logger.error('[GET /api/user/profile] Error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/user/risk-profile ─────────────────────────────────────────────
// Body: { risk_profile: 'conservative' | 'moderate' | 'aggressive' }
//
// Segment logic:
//   conservative → ['EQUITY']
//   moderate     → ['EQUITY']
//   aggressive   → ['EQUITY', 'FO']
router.patch('/risk-profile', async (req: any, res: Response) => {
  const { risk_profile } = req.body;
  const allowed = ['conservative', 'moderate', 'aggressive'];

  if (!allowed.includes(risk_profile)) {
    return res.status(400).json({
      error: 'Invalid risk_profile value. Must be conservative | moderate | aggressive',
    });
  }

  try {
    const newSegments = risk_profile === 'aggressive'
      ? ['EQUITY', 'FO']
      : ['EQUITY'];

    const { rows } = await query(
      `UPDATE users
       SET    risk_profile      = $1,
              segments_enabled  = $2::jsonb
       WHERE  id                = $3
       RETURNING id, risk_profile, segments_enabled`,
      [risk_profile, JSON.stringify(newSegments), req.user.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    logger.info(`[risk-profile] User ${req.user.id} → ${risk_profile}, segments: ${newSegments}`);
    return res.json(rows[0]);
  } catch (e) {
    logger.error('[PATCH /api/user/risk-profile] Error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Helper: compute profile completeness score 0–100 ─────────────────────────
function deriveProfileCompleteness(u: any): number {
  let score = 0;
  const checks = [
    { passes: !!u.email,                   weight: 20 }, // has email / signed up
    { passes: u.kyc_status === 'approved', weight: 30 }, // KYC approved
    { passes: !!u.is_uptox_connected,      weight: 25 }, // broker linked
    { passes: !!u.risk_profile,            weight: 15 }, // risk questionnaire done
    { passes: !!u.is_onboarding_complete,  weight: 10 }, // onboarding steps done
  ];
  checks.forEach(c => { if (c.passes) score += c.weight; });
  return score;
}

export default router;