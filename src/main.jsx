import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import { BranchProvider } from './branch/BranchContext.jsx';
import './index.css';
import { BrandProvider } from './config/BrandContext.jsx';
import { ThemeProvider } from './config/ThemeContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <BrandProvider>
        <ThemeProvider>
          <AuthProvider>
            <BranchProvider>
              <App />
            </BranchProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrandProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
