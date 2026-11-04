import { supabase } from '@/shared/lib/supabaseClient';

export type TestCardBrand =
  | 'Visa'
  | 'Mastercard'
  | 'American Express';

export async function registerCardTestAttempt(
  amount: number,
  lastFour: string,
  brand: TestCardBrand,
  postalCode: string
): Promise<void> {
  const { error } = await supabase.rpc(
    'fn_register_card_test_attempt',
    {
      p_amount: amount,
      p_last_four: lastFour,
      p_card_brand: brand,
      p_postal_code: postalCode,
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function registerBlockedCardAttempt(
  amount: number
): Promise<void> {
  const { error } = await supabase.rpc(
    'fn_register_blocked_card_attempt',
    { p_amount: amount }
  );

  if (error) {
    throw new Error(error.message);
  }
}