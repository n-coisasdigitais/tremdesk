import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { User, Upload, HardDrive, Mail, Settings2, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, ExternalLink, Wrench } from 'lucide-react';
import { ErrorLogsPanel } from '@/components/admin/ErrorLogsPanel';
import { MigrateToGoogleDrivePanel } from '@/components/admin/MigrateToGoogleDrivePanel';

interface SystemSetting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  is_secret: boolean;
}

const Settings = () => {
  const { user, profile, isAdmin } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Integration settings
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Form values for integrations
  const [googleServiceAccountEmail, setGoogleServiceAccountEmail] = useState('');
  const [googleServiceAccountKey, setGoogleServiceAccountKey] = useState('');
  const [googleDriveRootFolderId, setGoogleDriveRootFolderId] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromEmail, setResendFromEmail] = useState('');
  const [resendFromName, setResendFromName] = useState('');
  
  // External links
  const [leadsSystemUrl, setLeadsSystemUrl] = useState('');
  const [leadsSystemName, setLeadsSystemName] = useState('');
  const [financeSystemUrl, setFinanceSystemUrl] = useState('');
  const [financeSystemName, setFinanceSystemName] = useState('');
  
  // Show/hide password fields
  const [showServiceAccountKey, setShowServiceAccountKey] = useState(false);
  const [showResendApiKey, setShowResendApiKey] = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  useEffect(() => {
    if (isAdmin) {
      fetchSettings();
    }
  }, [isAdmin]);

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) throw error;

      setSettings(data || []);
      
      // Populate form fields
      data?.forEach(setting => {
        switch (setting.key) {
          case 'google_service_account_email':
            setGoogleServiceAccountEmail(setting.value || '');
            break;
          case 'google_service_account_key':
            setGoogleServiceAccountKey(setting.value || '');
            break;
          case 'google_drive_root_folder_id':
            setGoogleDriveRootFolderId(setting.value || '');
            break;
          case 'resend_api_key':
            setResendApiKey(setting.value || '');
            break;
          case 'resend_from_email':
            setResendFromEmail(setting.value || '');
            break;
          case 'resend_from_name':
            setResendFromName(setting.value || '');
            break;
          case 'system_link_leads_url':
            setLeadsSystemUrl(setting.value || '');
            break;
          case 'system_link_leads_name':
            setLeadsSystemName(setting.value || '');
            break;
          case 'system_link_finance_url':
            setFinanceSystemUrl(setting.value || '');
            break;
          case 'system_link_finance_name':
            setFinanceSystemName(setting.value || '');
            break;
        }
      });
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Erro ao carregar configurações',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      let avatarUrl = profile?.avatar_url;

      // Upload avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          avatar_url: avatarUrl,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram salvas com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar perfil',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
    }
  };

  const saveSetting = async (key: string, value: string, isSecret: boolean = false) => {
    const existingSetting = settings.find(s => s.key === key);
    
    if (existingSetting) {
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          value, 
          is_secret: isSecret,
          updated_by: user?.id 
        })
        .eq('key', key);
      
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('system_settings')
        .insert({ 
          key, 
          value, 
          is_secret: isSecret,
          updated_by: user?.id 
        });
      
      if (error) throw error;
    }
  };

  const handleSaveGoogleDriveSettings = async () => {
    setSavingSettings(true);
    try {
      await Promise.all([
        saveSetting('google_service_account_email', googleServiceAccountEmail),
        saveSetting('google_service_account_key', googleServiceAccountKey, true),
        saveSetting('google_drive_root_folder_id', googleDriveRootFolderId),
      ]);

      toast({
        title: 'Configurações salvas',
        description: 'As configurações do Google Drive foram salvas com sucesso.',
      });
      
      fetchSettings();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar configurações',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveResendSettings = async () => {
    setSavingSettings(true);
    try {
      await Promise.all([
        saveSetting('resend_api_key', resendApiKey, true),
        saveSetting('resend_from_email', resendFromEmail),
        saveSetting('resend_from_name', resendFromName),
      ]);

      toast({
        title: 'Configurações salvas',
        description: 'As configurações do Resend foram salvas com sucesso.',
      });
      
      fetchSettings();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar configurações',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveExternalLinks = async () => {
    setSavingSettings(true);
    try {
      await Promise.all([
        saveSetting('system_link_leads_url', leadsSystemUrl),
        saveSetting('system_link_leads_name', leadsSystemName),
        saveSetting('system_link_finance_url', financeSystemUrl),
        saveSetting('system_link_finance_name', financeSystemName),
      ]);

      toast({
        title: 'Links salvos',
        description: 'Os links externos foram salvos com sucesso.',
      });
      
      fetchSettings();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar links',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const isGoogleDriveConfigured = googleServiceAccountEmail && googleServiceAccountKey && googleDriveRootFolderId;
  const isResendConfigured = resendApiKey && resendFromEmail;
  const isExternalLinksConfigured = leadsSystemUrl || financeSystemUrl;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie suas configurações de conta e preferências.
          </p>
        </div>

        <Tabs defaultValue="perfil" className="space-y-6">
          <TabsList>
            <TabsTrigger value="perfil" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="integracoes" className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Integrações
                </TabsTrigger>
                <TabsTrigger value="ferramentas" className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Ferramentas
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="perfil">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Profile Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Perfil
                  </CardTitle>
                  <CardDescription>
                    Atualize suas informações pessoais.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage 
                        src={avatarFile ? URL.createObjectURL(avatarFile) : profile?.avatar_url || undefined} 
                        alt={fullName} 
                      />
                      <AvatarFallback className="text-2xl">
                        {fullName?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Label htmlFor="avatar" className="cursor-pointer">
                        <Button variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Alterar foto
                          </span>
                        </Button>
                      </Label>
                      <Input
                        id="avatar"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      O e-mail não pode ser alterado.
                    </p>
                  </div>

                  <Button onClick={handleUpdateProfile} disabled={isLoading}>
                    {isLoading ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                </CardContent>
              </Card>

              {/* Google Drive Integration (placeholder for non-admins) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Integração Google Drive
                  </CardTitle>
                  <CardDescription>
                    Configure a integração com o Google Drive para upload de arquivos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <HardDrive className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    {isAdmin ? (
                      <>
                        <h3 className="font-medium mb-2">Configure na aba Integrações</h3>
                        <p className="text-sm text-muted-foreground">
                          Acesse a aba "Integrações" para configurar o Google Drive.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-medium mb-2">Em breve</h3>
                        <p className="text-sm text-muted-foreground">
                          A integração com o Google Drive está em desenvolvimento. 
                          Em breve você poderá fazer upload de arquivos diretamente para o Drive.
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Integrations Tab (Admin only) */}
          {isAdmin && (
            <>
            <TabsContent value="integracoes">
              {settingsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Google Drive Configuration */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <HardDrive className="h-5 w-5" />
                          Google Drive
                        </CardTitle>
                        {isGoogleDriveConfigured ? (
                          <span className="flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Configurado
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-amber-600">
                            <AlertCircle className="h-4 w-4" />
                            Pendente
                          </span>
                        )}
                      </div>
                      <CardDescription>
                        Configure a Service Account do Google para integração com o Drive.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="googleServiceAccountEmail">Email da Service Account</Label>
                        <Input
                          id="googleServiceAccountEmail"
                          type="email"
                          value={googleServiceAccountEmail}
                          onChange={(e) => setGoogleServiceAccountEmail(e.target.value)}
                          placeholder="service-account@project.iam.gserviceaccount.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          Email da Service Account criada no Google Cloud Console.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="googleServiceAccountKey">Chave Privada (JSON)</Label>
                        <div className="relative">
                          <Textarea
                            id="googleServiceAccountKey"
                            value={googleServiceAccountKey}
                            onChange={(e) => setGoogleServiceAccountKey(e.target.value)}
                            placeholder='{"type": "service_account", "private_key": "...", ...}'
                            className={`min-h-[100px] pr-10 font-mono text-xs ${!showServiceAccountKey ? 'text-transparent selection:text-transparent' : ''}`}
                            style={!showServiceAccountKey ? { 
                              color: 'transparent',
                              textShadow: '0 0 8px rgba(0,0,0,0.5)'
                            } : {}}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2"
                            onClick={() => setShowServiceAccountKey(!showServiceAccountKey)}
                          >
                            {showServiceAccountKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Cole o conteúdo completo do arquivo JSON da Service Account.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="googleDriveRootFolderId">ID da Pasta Raiz</Label>
                        <Input
                          id="googleDriveRootFolderId"
                          value={googleDriveRootFolderId}
                          onChange={(e) => setGoogleDriveRootFolderId(e.target.value)}
                          placeholder="1a2b3c4d5e6f7g8h9i0j"
                        />
                        <p className="text-xs text-muted-foreground">
                          ID da pasta no Drive onde as subpastas das empresas serão criadas.
                          Encontre o ID na URL da pasta: drive.google.com/drive/folders/<strong>[ID]</strong>
                        </p>
                      </div>

                      <Button 
                        onClick={handleSaveGoogleDriveSettings} 
                        disabled={savingSettings}
                        className="w-full"
                      >
                        {savingSettings ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar configurações do Google Drive'
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Resend Configuration */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Mail className="h-5 w-5" />
                          Resend (Emails)
                        </CardTitle>
                        {isResendConfigured ? (
                          <span className="flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Configurado
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-amber-600">
                            <AlertCircle className="h-4 w-4" />
                            Pendente
                          </span>
                        )}
                      </div>
                      <CardDescription>
                        Configure o Resend para envio de notificações por email.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="resendApiKey">API Key</Label>
                        <div className="relative">
                          <Input
                            id="resendApiKey"
                            type={showResendApiKey ? 'text' : 'password'}
                            value={resendApiKey}
                            onChange={(e) => setResendApiKey(e.target.value)}
                            placeholder="re_xxxxxxxxxx"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0"
                            onClick={() => setShowResendApiKey(!showResendApiKey)}
                          >
                            {showResendApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Crie sua API Key em{' '}
                          <a 
                            href="https://resend.com/api-keys" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary underline"
                          >
                            resend.com/api-keys
                          </a>
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="resendFromEmail">Email Remetente</Label>
                        <Input
                          id="resendFromEmail"
                          type="email"
                          value={resendFromEmail}
                          onChange={(e) => setResendFromEmail(e.target.value)}
                          placeholder="noreply@seudominio.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          Email que aparecerá como remetente. Precisa ser de um domínio verificado no Resend.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="resendFromName">Nome do Remetente</Label>
                        <Input
                          id="resendFromName"
                          value={resendFromName}
                          onChange={(e) => setResendFromName(e.target.value)}
                          placeholder="Trem Desk"
                        />
                        <p className="text-xs text-muted-foreground">
                          Nome que aparecerá junto ao email do remetente.
                        </p>
                      </div>

                      <Button 
                        onClick={handleSaveResendSettings} 
                        disabled={savingSettings}
                        className="w-full"
                      >
                        {savingSettings ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar configurações do Resend'
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* External Links Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <ExternalLink className="h-5 w-5" />
                          Links Externos
                        </CardTitle>
                        {isExternalLinksConfigured ? (
                          <span className="flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Configurado
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-amber-600">
                            <AlertCircle className="h-4 w-4" />
                            Pendente
                          </span>
                        )}
                      </div>
                      <CardDescription>
                        Configure os links para sistemas externos exibidos no Dashboard.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-4 border-b pb-4">
                        <h4 className="text-sm font-medium">Dashboard de Campanhas</h4>
                        <div className="space-y-2">
                          <Label htmlFor="leadsSystemUrl">URL do Sistema</Label>
                          <Input
                            id="leadsSystemUrl"
                            type="url"
                            value={leadsSystemUrl}
                            onChange={(e) => setLeadsSystemUrl(e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="leadsSystemName">Nome de Exibição</Label>
                          <Input
                            id="leadsSystemName"
                            value={leadsSystemName}
                            onChange={(e) => setLeadsSystemName(e.target.value)}
                            placeholder="Dashboard de Campanhas"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-medium">Portal Financeiro</h4>
                        <div className="space-y-2">
                          <Label htmlFor="financeSystemUrl">URL do Sistema</Label>
                          <Input
                            id="financeSystemUrl"
                            type="url"
                            value={financeSystemUrl}
                            onChange={(e) => setFinanceSystemUrl(e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="financeSystemName">Nome de Exibição</Label>
                          <Input
                            id="financeSystemName"
                            value={financeSystemName}
                            onChange={(e) => setFinanceSystemName(e.target.value)}
                            placeholder="Portal Financeiro"
                          />
                        </div>
                      </div>

                      <Button 
                        onClick={handleSaveExternalLinks} 
                        disabled={savingSettings}
                        className="w-full"
                      >
                        {savingSettings ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar Links Externos'
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Instructions Card */}
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle>Instruções de Configuração</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <HardDrive className="h-4 w-4" />
                          Google Drive
                        </h4>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                          <li>Acesse o <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a></li>
                          <li>Crie um novo projeto ou selecione um existente</li>
                          <li>Ative a API do Google Drive em "APIs e Serviços"</li>
                          <li>Crie uma Service Account em "Credenciais"</li>
                          <li>Baixe o arquivo JSON da chave da Service Account</li>
                          <li>Compartilhe a pasta raiz do Drive com o email da Service Account (como Editor)</li>
                          <li>Cole as informações nos campos acima</li>
                        </ol>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Resend
                        </h4>
                        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                          <li>Crie uma conta em <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com</a></li>
                          <li>Adicione e verifique seu domínio em "Domains"</li>
                          <li>Crie uma API Key em "API Keys"</li>
                          <li>Configure o email remetente usando o domínio verificado</li>
                        </ol>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Admin Tools Tab */}
            <TabsContent value="ferramentas">
              <div className="space-y-6">
                <MigrateToGoogleDrivePanel />
                <ErrorLogsPanel />
              </div>
            </TabsContent>
          </>
        )}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;
