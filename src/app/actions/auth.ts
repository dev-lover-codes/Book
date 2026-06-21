'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

export async function signInWithPhone(phone: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+91${phone}`,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown auth error' };
  }
}

export async function verifyPhoneOtp(phone: string, token: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone: `+91${phone}`,
      token,
      type: 'sms',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, session: data.session, user: data.user };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown auth error' };
  }
}

// Fallback password login for local testing
export async function signInWithEmail(email: string, password: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, session: data.session, user: data.user };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown auth error' };
  }
}

// Fallback signup for local testing
export async function signUpWithEmail(email: string, password: string) {
  try {
    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch {
      // Fallback if service role key is not configured
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, user: data.user };
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown auth error' };
  }
}

export async function signInWithGoogle(redirectToOrigin: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${redirectToOrigin}/auth/callback`,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { success: false, error: 'OAuth redirect URL not generated.' };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { success: true };
}

export async function adminCreateCustomer(name: string, phone: string) {
  try {
    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch {
      return { success: false, error: 'SERVICE_ROLE_KEY_MISSING' };
    }

    const cleanPhone = phone.replace('+', '');
    const dummyEmail = `customer_${cleanPhone}@gmail.com`;
    const dummyPassword = `Pass_${cleanPhone}`;

    const { data, error } = await adminClient.auth.admin.createUser({
      email: dummyEmail,
      password: dummyPassword,
      email_confirm: true, // auto-confirms email so no verification email is sent!
      user_metadata: {
        full_name: name,
        phone: phone
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user?.id) {
      const { error: profileError } = await adminClient
        .from('profiles')
        .upsert({
          id: data.user.id,
          full_name: name,
          phone: phone,
          role: 'customer',
          preferred_language: 'hi'
        });
      if (profileError) {
        return { success: false, error: `Failed to insert customer profile: ${profileError.message}` };
      }
    }

    return { success: true, userId: data.user?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown admin auth error' };
  }
}

export async function findProfileByPhone(phone: string) {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (error) throw error;
    return { success: true, profile: data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchRetailerRelationships(retailerId: string) {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('relationships')
      .select(`
        id,
        customer_id,
        balance,
        customer:profiles!customer_id(full_name, phone, address, email, notes)
      `)
      .eq('retailer_id', retailerId);

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchCustomerRelationships(customerId: string) {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('relationships')
      .select(`
        id,
        retailer_id,
        balance,
        retailer:profiles!retailer_id(full_name, phone, business_name, business_address, business_category, business_upi, business_phone)
      `)
      .eq('customer_id', customerId);

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateProfile(
  profileId: string,
  data: {
    full_name?: string;
    business_name?: string;
    business_address?: string;
    business_category?: string;
    business_upi?: string;
    business_phone?: string;
    business_gstin?: string;
  }
) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('profiles')
      .update(data)
      .eq('id', profileId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateCustomerDetails(
  customerId: string,
  data: {
    address?: string;
    email?: string;
    notes?: string;
  }
) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('profiles')
      .update(data)
      .eq('id', customerId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

