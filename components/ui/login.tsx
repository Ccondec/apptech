import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle, Lock, Mail, ArrowRight } from 'lucide-react';

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginFormProps {
  onLogin: (data: LoginFormData) => void;
  onForgotPassword: () => void;
}

const Login: React.FC<LoginFormProps> = ({ onLogin, onForgotPassword }) => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<Partial<LoginFormData>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<LoginFormData> = {};
    
    if (!formData.email) {
      newErrors.email = 'El correo electrónico es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Por favor ingresa un correo electrónico válido';
    }
    
    if (!formData.password) {
      newErrors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user types
    if (errors[name as keyof LoginFormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  // Credenciales predefinidas para pruebas
  const predefinedCredentials = [
    { email: 'admin@ionenergy.com.co', password: 'admin123', role: 'Administrador' },
    { email: 'tecnico@ionenergy.com.co', password: 'tecnico123', role: 'Técnico' },
    { email: 'supervisor@ionenergy.com.co', password: 'super123', role: 'Supervisor' }
  ];

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Simulate API call with validation against predefined credentials
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if the credentials match any of the predefined ones
      const matchedUser = predefinedCredentials.find(
        user => user.email === formData.email && user.password === formData.password
      );
      
      if (matchedUser) {
        onLogin({ ...formData, role: matchedUser.role });
      } else {
        setErrors({ password: 'Credenciales inválidas. Por favor, inténtalo de nuevo.' });
      }
    } catch (error) {
      console.error('Error logging in:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <h2 className="text-2xl font-bold text-center">Ion Energy S.A.S</h2>
          <p className="text-center text-gray-600">Accede a tu cuenta</p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Correo Electrónico
              </Label>
              <Input 
                id="email"
                name="email"
                type="email"
                placeholder="ejemplo@ionenergy.com.co"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? "border-red-500" : ""}
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-red-500 text-sm flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.email}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Contraseña
              </Label>
              <Input 
                id="password"
                name="password"
                type="password"
                placeholder="******"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? "border-red-500" : ""}
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="text-red-500 text-sm flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.password}
                </p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Iniciar Sesión <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4">
          <button 
            onClick={onForgotPassword}
            className="text-sm text-blue-600 hover:text-blue-800 w-full text-center"
          >
            ¿Olvidaste tu contraseña?
          </button>
          
          <div className="text-center text-xs text-gray-500 w-full">
            <p>© {new Date().getFullYear()} IonEnergy S.A.S Todos los derechos reservados.</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;