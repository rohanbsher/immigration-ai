'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, Loader2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { UserRole } from '@/types';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState<UserRole>('attorney');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    barNumber: '',
    firmName: '',
  });
  const [confirmationSent, setConfirmationSent] = useState(false);
  const { signUp, signInWithOAuth, isLoading } = useAuth();

  const passwordChecks = useMemo(() => ({
    minLength: formData.password.length >= 8,
    hasUppercase: /[A-Z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
  }), [formData.password]);

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast.error('Please meet all password requirements');
      return;
    }

    if (accountType === 'attorney' && !formData.barNumber) {
      toast.error('Bar number is required for attorneys');
      return;
    }

    try {
      const result = await signUp({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: accountType,
        barNumber: formData.barNumber || undefined,
        firmName: formData.firmName || undefined,
      });

      if (result.requiresConfirmation) {
        setConfirmationSent(true);
        toast.success('Check your email to confirm your account');
      } else {
        toast.success('Account created successfully!');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const handleOAuthLogin = async (provider: 'google' | 'azure') => {
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'OAuth login failed');
    }
  };

  if (confirmationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                IA
              </div>
              <span className="font-semibold text-xl">Immigration AI</span>
            </Link>
          </div>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <Check className="text-green-600" size={24} />
              </div>
              <CardTitle>Check your email</CardTitle>
              <CardDescription>
                We&apos;ve sent a confirmation link to <strong>{formData.email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-slate-600 mb-4">
                Click the link in the email to activate your account.
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Back to login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              IA
            </div>
            <span className="font-semibold text-xl">Immigration AI</span>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Start managing immigration cases efficiently
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Account Type Selection */}
            <Tabs
              value={accountType}
              onValueChange={(v) => setAccountType(v as UserRole)}
              className="mb-6"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="attorney">I&apos;m an Attorney</TabsTrigger>
                <TabsTrigger value="client">I&apos;m a Client</TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  disabled={isLoading}
                />
              </div>

              {accountType === 'attorney' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="barNumber">
                      Bar Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="barNumber"
                      placeholder="Enter your bar number"
                      value={formData.barNumber}
                      onChange={handleInputChange}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firmName">Firm Name (Optional)</Label>
                    <Input
                      id="firmName"
                      placeholder="Law Firm LLC"
                      value={formData.firmName}
                      onChange={handleInputChange}
                      disabled={isLoading}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
                <div className="text-xs text-slate-500 space-y-1 mt-2">
                  <PasswordRequirement met={passwordChecks.minLength} text="At least 8 characters" />
                  <PasswordRequirement met={passwordChecks.hasUppercase} text="One uppercase letter" />
                  <PasswordRequirement met={passwordChecks.hasNumber} text="One number" />
                  <PasswordRequirement met={passwordChecks.hasSpecial} text="One special character" />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !isPasswordValid}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-sm text-slate-500">
                or continue with
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => handleOAuthLogin('google')}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => handleOAuthLogin('azure')}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M11.4 24H0V12.6L11.4 0v7.2L4.8 14.4h6.6V24zM24 24H12.6V12.6L24 0v7.2l-6.6 7.2H24V24z"
                  />
                </svg>
                Microsoft
              </Button>
            </div>

            <p className="text-center text-sm text-slate-600 mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:underline">
                Sign in
              </Link>
            </p>

            <p className="text-center text-xs text-slate-500 mt-4">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <Check size={12} className="text-green-500" />
      ) : (
        <AlertCircle size={12} className="text-slate-300" />
      )}
      <span className={met ? 'text-green-600' : 'text-slate-400'}>{text}</span>
    </div>
  );
}
