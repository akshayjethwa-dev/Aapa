import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { UpstoxBrokerService } from '../../../../lib/brokers/upstox';

// 1. Initialize Supabase Admin Client
// We use the SERVICE_ROLE_KEY to bypass RLS securely on the backend, 
// ensuring we can reliably log exchange data regardless of frontend session state.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

const upstoxService = new UpstoxBrokerService();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const orderId = req.query.id as string;
  const authHeader = req.headers.authorization;

  if (!orderId || !authHeader) {
    return res.status(400).json({ error: 'Missing order ID or authorization' });
  }

  try {
    // 2. Authenticate the User
    // Extract the JWT from the Bearer token and verify it with Supabase
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 3. Retrieve User's Upstox Access Token
    // Fetch the broker token securely stored in your database for this user
    const { data: userData, error: dbError } = await supabaseAdmin
      .from('user_profiles') // Adjust to your actual table name holding broker tokens
      .select('upstox_access_token')
      .eq('id', user.id)
      .single();

    if (dbError || !userData?.upstox_access_token) {
      return res.status(403).json({ error: 'Upstox account not linked or token missing' });
    }

    const upstoxToken = userData.upstox_access_token;

    // 4. Fetch Live Order Details from Upstox
    const orderDetails = await upstoxService.getOrderDetails(upstoxToken, orderId);

    // 5. Check for Terminal State and Sync with Supabase
    if (orderDetails.is_terminal) {
      // Upsert the record: If it exists, update it. If not, insert it.
      // This ensures our local database matches the exchange reality.
      const { error: syncError } = await supabaseAdmin
        .from('orders_history')
        .upsert({
          user_id: user.id,
          broker_order_id: orderId,
          symbol: orderDetails.trading_symbol,
          quantity: orderDetails.quantity,
          price: orderDetails.average_price || orderDetails.price,
          status: orderDetails.normalized_status,
          status_message: orderDetails.status_message || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'broker_order_id' // Uses the unique index we created
        });

      if (syncError) {
        console.error(`[Supabase Sync Error] Order ID ${orderId}:`, syncError);
        // We log the error but do not fail the request; the user still needs to see the UI update.
      }
    }

    // 6. Return the status to the frontend
    return res.status(200).json(orderDetails);

  } catch (error: any) {
    console.error(`[API] Error polling order ${orderId}:`, error.message);
    return res.status(500).json({ 
      error: 'Failed to poll order status', 
      details: error.message 
    });
  }
}