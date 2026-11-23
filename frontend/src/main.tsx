import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ShopProvider } from './context/ShopContext';
import { ToastProvider } from './context/ToastContext';
import './index.css';

// A data router is required for <ScrollRestoration /> used in the layout.
const router = createBrowserRouter([{ path: '*', element: <App /> }]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <ShopProvider>
          <RouterProvider router={router} />
        </ShopProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>,
);
