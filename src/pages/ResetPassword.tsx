import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle } from 'lucide-react';
import { AnimatedLogo } from '@/components/AnimatedLogo';
import { supabase } from '@/integrations/supabase/client';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      // Listen for password recovery event
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth event:', event, session);
          if (event === 'PASSWORD_RECOVERY') {
            setIsValidSession(true);
            setIsChecking(false);
          } else if (event === 'SIGNED_IN' && session) {
            setIsValidSession(true);
            setIsChecking(false);
          }
        }
      );

      // Check URL for recovery token (Supabase adds this on redirect)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      // Also check query params (some Supabase versions use query params)
      const queryParams = new URLSearchParams(window.location.search);
      const queryType = queryParams.get('type');
      
      if ((type === 'recovery' || queryType === 'recovery') && accessToken) {
        // Set the session from the recovery token
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get('refresh_token') || '',
        });
        
        if (!error) {
          setIsValidSession(true);
        }
        setIsChecking(false);
      } else {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsValidSession(true);
        }
        setIsChecking(false);
      }

      return () => subscription.unsubscribe();
    };
    
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast({
        title: 'Senha inválida',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive'
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'A confirmação de senha deve ser igual à senha.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await updatePassword(password);
      
      if (error) {
        toast({
          title: 'Erro ao redefinir senha',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        setIsSuccess(true);
        toast({
          title: 'Senha redefinida!',
          description: 'Sua senha foi alterada com sucesso.',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro inesperado',
        description: 'Ocorreu um erro ao redefinir sua senha.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Verificando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2 pb-4">
            <div className="flex flex-col items-center gap-3">
              <AnimatedLogo size="lg" />
            </div>
            <CardDescription className="text-center text-sm text-destructive">
              Link inválido ou expirado
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              O link de recuperação de senha é inválido ou já expirou. 
              Por favor, solicite um novo link.
            </p>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Voltar ao login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2 pb-4">
            <div className="flex flex-col items-center gap-3">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardDescription className="text-center text-sm">
              Senha redefinida com sucesso!
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Sua senha foi alterada. Você já pode fazer login com sua nova senha.
            </p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Ir para o Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex flex-col items-center gap-3">
            <AnimatedLogo size="lg" />
          </div>
          <CardDescription className="text-center text-sm">
            Definir nova senha
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar nova senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}