import { supabase } from '@/shared/lib/supabaseClient';

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  provider_reply: string | null;
  created_at: string;
  profiles?: { full_name: string };
}

export async function listProviderReviews(providerId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, provider_reply, created_at, profiles(full_name)')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Review[];
}

export async function getProviderPublicInfo(providerId: string) {
  const { data, error } = await supabase
    .from('providers')
    .select('business_name, bio, rating_avg, rating_count, sales_count, verified')
    .eq('id', providerId)
    .single();
  if (error) throw error;
  return data;
}

export async function submitReview(orderId: string, rating: number, comment: string) {
  const { data, error } = await supabase.rpc('fn_submit_review', {
    p_order_id: orderId,
    p_rating: rating,
    p_comment: comment,
  });
  if (error) throw error;
  return data as string;
}
