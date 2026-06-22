import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const schema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { userId } = parsed.data;

    // 1. Verify the requesting user is actually authenticated as this userId
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only delete your own account.' },
        { status: 403 }
      );
    }

    // 2. Use admin client for privileged deletions (bypasses RLS)
    const adminClient = createAdminClient();

    // 3. Delete all transactions the user was part of
    // First get all relationship IDs for this user
    const { data: retailerRels } = await adminClient
      .from('relationships')
      .select('id')
      .eq('retailer_id', userId);

    const { data: customerRels } = await adminClient
      .from('relationships')
      .select('id')
      .eq('customer_id', userId);

    const allRelIds = [
      ...(retailerRels || []).map((r) => r.id),
      ...(customerRels || []).map((r) => r.id),
    ];

    if (allRelIds.length > 0) {
      await adminClient.from('transactions').delete().in('relationship_id', allRelIds);
    }

    // 4. Delete relationships
    await adminClient.from('relationships').delete().eq('retailer_id', userId);
    await adminClient.from('relationships').delete().eq('customer_id', userId);

    // 5. Delete inventory items for this retailer
    await adminClient.from('inventory').delete().eq('retailer_id', userId);

    // 6. Delete stationery sales for this retailer (if table exists)
    try {
      await adminClient.from('stationery_sales').delete().eq('retailer_id', userId);
    } catch {
      // Table may not exist in all environments — silently skip
    }

    // 7. Delete chat logs
    await adminClient.from('chat_logs').delete().eq('user_id', userId);

    // 8. Delete reminders
    try {
      await adminClient.from('reminders').delete().eq('retailer_id', userId);
      await adminClient.from('reminders').delete().eq('customer_id', userId);
    } catch {
      // Silently skip if reminders table doesn't exist
    }

    // 9. Delete the profile row (cascade should handle auth.users ref, but we do it explicitly)
    await adminClient.from('profiles').delete().eq('id', userId);

    // 10. Finally delete the auth user via Admin API
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('[DeleteAccount] Failed to delete auth user:', deleteAuthError.message);
      return NextResponse.json(
        { error: `Failed to delete auth account: ${deleteAuthError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Account permanently deleted.' });
  } catch (error) {
    console.error('[DeleteAccount] Unexpected error:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
