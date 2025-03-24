"use client"
import React, { useState, useEffect } from 'react';
import Login from '@/components/ui/login';
import TechnicalForm from '@/components/ui/TechnicalForm';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

interface User {
  email: string;
  name: string;
  role: string;
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const handleLogin = ({ email, password, role }: { email: string; password: string; role?: string }) => {
    // Las credenciales ya fueron validadas en el componente Login
    setCurrentUser({
      email,
      name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1), // Capitalize first letter
      role: role || 'Usuario'
    });
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const handleForgotPassword = () => {
    // In a real app, you would implement password recovery
    alert('Función de recuperación de contraseña en desarrollo');
  };
  
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} onForgotPassword={handleForgotPassword} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with user info */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">{currentUser?.name}</p>
                <p className="text-xs text-gray-500">{currentUser?.role}</p>
              </div>
            </div>
            <Button 
              onClick={handleLogout}
              className="flex items-center gap-2 bg-green-600 hover:bg-red-600 text-white"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="py-6">
        <TechnicalForm />
      </main>
    </div>
  );
};

export default App;