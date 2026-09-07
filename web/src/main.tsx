import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import CityDashboardProvider from './components/city/CityDashboardProvider';
import './i18n';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* сводка по городу открывается из любой точки приложения */}
        <CityDashboardProvider>
          <App />
        </CityDashboardProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);

// Fade the pre-React boot loader out once the first paint lands.
requestAnimationFrame(() => {
  setTimeout(() => document.getElementById('boot-loader')?.classList.add('done'), 220);
});
