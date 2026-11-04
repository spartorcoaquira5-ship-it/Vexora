import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/shared/hooks/useAuth';
import { AppRouter } from '@/app/router';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
