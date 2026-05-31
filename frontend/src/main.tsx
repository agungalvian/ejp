import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e2130',
            color: '#f1f5f9',
            border: '1px solid #2d3347',
            borderRadius: '10px',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#1e2130' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#1e2130' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
