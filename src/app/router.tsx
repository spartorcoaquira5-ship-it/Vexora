
import { Routes, Route } from 'react-router-dom';

import LoginPage from '@/features/auth/pages/LoginPage';
import RegisterPage from '@/features/auth/pages/RegisterPage';

import { ProtectedRoute } from './ProtectedRoute';
import { SidebarLayout } from '@/shared/layouts/SidebarLayout';

import MarketplacePage from '@/features/marketplace/pages/MarketplacePage';
import { StorefrontLayout } from '@/shared/layouts/StorefrontLayout';

import PurchasesPage from '@/features/purchases/pages/PurchasesPage';
import WalletPage from '@/features/wallet/pages/WalletPage';
import ClaimsPage from '@/features/claims/pages/ClaimsPage';
import NotificationsPage from '@/features/notifications/pages/NotificationsPage';

import ProviderProfilePage from '@/features/provider/pages/ProviderProfilePage';
import InventoryPage from '@/features/provider/pages/InventoryPage';
import SalesPage from '@/features/provider/pages/SalesPage';
import WithdrawalsPage from '@/features/provider/pages/WithdrawalsPage';
import ProviderDashboardPage from '@/features/provider/pages/ProviderDashboardPage';


import AdminProductsPage from '@/features/admin/pages/AdminProductsPage';
import AdminRechargesPage from '@/features/admin/pages/AdminRechargesPage';
import AdminWithdrawalsPage from '@/features/admin/pages/AdminWithdrawalsPage';
import AdminProvidersPage from '@/features/admin/pages/AdminProvidersPage';
import AdminCouponsPage from '@/features/admin/pages/AdminCouponsPage';

type Role = 'cliente' | 'proveedor' | 'admin';

function Page({
  element,
  allow,
}: {
  element: React.ReactNode;
  allow?: Role[];
}) {
  return (
    <ProtectedRoute allow={allow}>
      <SidebarLayout>{element}</SidebarLayout>
    </ProtectedRoute>
  );
}

export function AppRouter() {
  return (
    <Routes>
      {/* Acceso público */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/"
        element={
          <StorefrontLayout>
            <MarketplacePage />
          </StorefrontLayout>
        }
      />

      <Route
        path="/marketplace"
        element={
          <StorefrontLayout>
            <MarketplacePage />
          </StorefrontLayout>
        }
      />

      {/* Cliente */}
      <Route
        path="/compras"
        element={<Page allow={['cliente']} element={<PurchasesPage />} />}
      />
      <Route
        path="/billetera"
        element={<Page allow={['cliente']} element={<WalletPage />} />}
      />
      <Route
        path="/reclamos"
        element={
          <Page
            allow={['cliente', 'proveedor', 'admin']}
            element={<ClaimsPage />}
          />
        }
      />
      <Route
        path="/notificaciones"
        element={<Page element={<NotificationsPage />} />}
      />

      {/* Proveedor */}
      <Route
        path="/perfil-proveedor"
        element={
          <Page allow={['proveedor']} element={<ProviderProfilePage />} />
        }
      />
      
<Route
  path="/dashboard-proveedor"
  element={
    <Page
      allow={['proveedor']}
      element={<ProviderDashboardPage />}
    />
  }
/>

      <Route
        path="/inventario"
        element={<Page allow={['proveedor']} element={<InventoryPage />} />}
      />
      <Route
        path="/ventas"
        element={<Page allow={['proveedor']} element={<SalesPage />} />}
      />
      <Route
        path="/retiros"
        element={
          <Page allow={['proveedor']} element={<WithdrawalsPage />} />
        }
      />

      {/* Administrador */}
      <Route
        path="/admin/productos"
        element={
          <Page allow={['admin']} element={<AdminProductsPage />} />
        }
      />
      <Route
        path="/admin/recargas"
        element={
          <Page allow={['admin']} element={<AdminRechargesPage />} />
        }
      />
      <Route
        path="/admin/retiros"
        element={
          <Page allow={['admin']} element={<AdminWithdrawalsPage />} />
        }
      />
      <Route
        path="/admin/proveedores"
        element={
          <Page allow={['admin']} element={<AdminProvidersPage />} />
        }
      />
      <Route
        path="/admin/cupones"
        element={
          <Page allow={['admin']} element={<AdminCouponsPage />} />
        }
      />

      <Route path="*" element={<StorefrontLayout><MarketplacePage /></StorefrontLayout>} />
    </Routes>
  );
}
