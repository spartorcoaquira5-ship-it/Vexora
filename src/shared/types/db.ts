// Tipos a mano que reflejan 01_schema.sql. Cuando el esquema esté estable,
// conviene generarlos automáticamente con:
//   npx supabase gen types typescript --project-id TU_PROJECT_ID > src/shared/types/database.types.ts

export type UserRole = 'admin' | 'proveedor' | 'cliente';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  status: 'activo' | 'suspendido';
  wallet_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Provider {
  id: string;
  business_name: string;
  status: 'activo' | 'limitado' | 'suspendido' | 'bloqueado';
  verified: boolean;
  retention_days: number;
  rating_avg: number;
  rating_count: number;
  sales_count: number;
  bio: string | null;
  verification_status: 'ninguna' | 'pendiente' | 'aprobada' | 'rechazada';
  verification_note: string | null;
  dni_proof_path: string | null;
  bank_statement_proof_path: string | null;
}

export interface Category { id: string; name: string; slug: string; }

export interface ProductDuration { id: string; product_id: string; label: string; days: number; }

export interface Product {
  id: string; category_id: string; name: string; slug: string; active: boolean;
  product_durations: ProductDuration[];
}

export interface ProviderOffer {
  id: string;
  provider_id: string;
  product_id: string;
  duration_id: string;
  price: number;
  commission_type: 'porcentaje' | 'monto_fijo';
  commission_value: number;
  status: 'activo' | 'pausado' | 'eliminado';
  providers?: { business_name: string; rating_avg: number; rating_count: number; verified: boolean };
  offer_stock?: { stock: number }[];
}

export interface Order {
  id: string;
  client_id: string;
  offer_id: string;
  provider_id: string;
  product_id: string;
  duration_id: string;
  price: number;
  commission_amount: number;
  provider_amount: number;
  status: 'completado' | 'en_reclamo' | 'reembolsado' | 'cancelado';
  financial_status: 'retenido' | 'liberado' | 'reembolsado' | 'ajustado';
  created_at: string;
  products?: { name: string };
  product_durations?: { label: string };
  providers?: { business_name: string };
}

export interface WalletMovement {
  id: string; type: 'recarga' | 'compra' | 'reembolso' | 'ajuste';
  amount: number; balance_after: number; description: string | null; created_at: string;
}

export interface Recharge {
  id: string; amount: number; method: string; status: 'pendiente' | 'confirmada' | 'rechazada' | 'cancelada';
  proof_url: string | null; reference: string | null; created_at: string;
}

export interface Claim {
  id: string; order_id: string; client_id: string; provider_id: string;
  reason: string; description: string | null;
  status: 'abierto' | 'en_revision' | 'resuelto' | 'cerrado';
  resolution_type: string | null; created_at: string;
  orders?: { products?: { name: string } };
  providers?: { business_name: string };
}

export interface ClaimMessage { id: string; claim_id: string; sender_id: string; message: string; created_at: string; }

export interface Notification {
  id: string; type: string; title: string; message: string; read: boolean; created_at: string;
}

export interface WithdrawalMethod {
  id: string; type: 'yape' | 'plin' | 'cuenta_bancaria'; details: Record<string, string>; is_primary: boolean;
}

export interface Withdrawal {
  id: string; amount: number; status: string; code: string | null; created_at: string;
  withdrawal_methods?: WithdrawalMethod;
  providers?: { business_name: string };
}

export interface Coupon {
  id: string; code: string; type: 'porcentaje' | 'monto_fijo'; value: number;
  max_uses: number; uses: number; active: boolean;
}
