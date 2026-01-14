import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  User, 
  Save, 
  X, 
  Link as LinkIcon,
  Bot,
  FileText,
  Building2
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useDayLogs, DayLogFormData } from '@/hooks/useDayLogs';
import { useDayLogTags } from '@/hooks/useDayLogTags';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DayLogTipTapEditor } from '@/components/DayLogTipTapEditor';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  name: string;
}

export default function DayLogNew() {
  const navigate = useNavigate();
  const { createDayLog } = useDayLogs();
  const { tags: dynamicTags } = useDayLogTags();
  const { profile, isAdmin, isTeamMember } = useAuth();
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  const [formData, setFormData] = useState<DayLogFormData>({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    work_done: '',
    work_pending: '',
    next_steps: '',
    work_done_json: null,
    work_pending_json: null,
    next_steps_json: null,
    tags: [],
    transcription_url: '',
    ai_assistant_url: '',
    meeting_notes: '',
    company_id: '',
  });

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    if (isAdmin || isTeamMember) {
      fetchCompanies();
    }
  }, [isAdmin, isTeamMember]);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    if (data) setCompanies(data);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setFormData(prev => ({
        ...prev,
        date: format(date, 'yyyy-MM-dd'),
      }));
    }
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.work_done.trim()) {
      return;
    }

    setSaving(true);
    const result = await createDayLog({
      ...formData,
      company_id: formData.company_id || undefined,
    });
    setSaving(false);

    if (result) {
      navigate('/daylog');
    }
  };

  return (
    <Layout>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Novo DayLog</h1>
            <p className="text-muted-foreground">Registre suas atividades do dia</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/daylog')}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !formData.work_done.trim()} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar DayLog'}
            </Button>
          </div>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date */}
              <div className="space-y-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-2"
                      type="button"
                    >
                      <Calendar className="h-4 w-4" />
                      {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* User (read-only) */}
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/50">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{profile?.full_name || 'Carregando...'}</span>
                </div>
              </div>
            </div>

            {/* Company (optional) */}
            {(isAdmin || isTeamMember) && companies.length > 0 && (
              <div className="space-y-2">
                <Label>Empresa (opcional)</Label>
                <Select 
                  value={formData.company_id || ''} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, company_id: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger className="w-full">
                    <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Vincular a uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma empresa</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Vincule este DayLog a uma empresa para organização
                </p>
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Resumo do dia (opcional)</Label>
              <Input
                id="description"
                placeholder="Ex: Dia focado em campanhas do cliente X"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Registro de Atividades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Work Done */}
            <div className="space-y-2">
              <Label htmlFor="work_done">
                O que foi feito hoje <span className="text-destructive">*</span>
              </Label>
              <DayLogTipTapEditor
                content={formData.work_done_json}
                onChange={(json, text) => setFormData(prev => ({ 
                  ...prev, 
                  work_done: text,
                  work_done_json: json 
                }))}
                placeholder="Descreva as atividades realizadas hoje..."
                minHeight="150px"
              />
            </div>

            {/* Work Pending */}
            <div className="space-y-2">
              <Label htmlFor="work_pending">O que ficou pendente</Label>
              <DayLogTipTapEditor
                content={formData.work_pending_json}
                onChange={(json, text) => setFormData(prev => ({ 
                  ...prev, 
                  work_pending: text,
                  work_pending_json: json 
                }))}
                placeholder="Atividades que não foram concluídas..."
                minHeight="100px"
              />
            </div>

            {/* Next Steps */}
            <div className="space-y-2">
              <Label htmlFor="next_steps">Próximos passos</Label>
              <DayLogTipTapEditor
                content={formData.next_steps_json}
                onChange={(json, text) => setFormData(prev => ({ 
                  ...prev, 
                  next_steps: text,
                  next_steps_json: json 
                }))}
                placeholder="O que precisa ser feito em seguida..."
                minHeight="100px"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Categorização</CardTitle>
          </CardHeader>
          <CardContent>
            <Label className="mb-3 block">Tags</Label>
            <div className="flex flex-wrap gap-2">
              {dynamicTags.map((tag) => {
                const isSelected = formData.tags.includes(tag.name);
                return (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className={cn(
                      'cursor-pointer transition-all px-3 py-1',
                      isSelected ? 'border-transparent' : 'hover:bg-muted'
                    )}
                    style={isSelected ? { backgroundColor: tag.bg_color, color: tag.text_color } : {}}
                    onClick={() => toggleTag(tag.name)}
                  >
                    {tag.name}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* External Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Links Externos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Transcription URL */}
            <div className="space-y-2">
              <Label htmlFor="transcription_url" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Link da transcrição
              </Label>
              <Input
                id="transcription_url"
                type="url"
                placeholder="https://fireflies.ai/... ou https://otter.ai/..."
                value={formData.transcription_url}
                onChange={(e) => setFormData(prev => ({ ...prev, transcription_url: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Fireflies, Otter.ai, Google Meet, etc.
              </p>
            </div>

            {/* AI Assistant URL */}
            <div className="space-y-2">
              <Label htmlFor="ai_assistant_url" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Link da IA/Assistente
              </Label>
              <Input
                id="ai_assistant_url"
                type="url"
                placeholder="https://chat.openai.com/... ou https://claude.ai/..."
                value={formData.ai_assistant_url}
                onChange={(e) => setFormData(prev => ({ ...prev, ai_assistant_url: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                ChatGPT, Claude, ou outra IA utilizada
              </p>
            </div>

            {/* Meeting Notes */}
            <div className="space-y-2">
              <Label htmlFor="meeting_notes">Notas de reunião</Label>
              <Textarea
                id="meeting_notes"
                placeholder="Anotações adicionais de reuniões..."
                className="min-h-[80px]"
                value={formData.meeting_notes}
                onChange={(e) => setFormData(prev => ({ ...prev, meeting_notes: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button (Mobile) */}
        <div className="flex justify-end gap-2 md:hidden">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/daylog')}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !formData.work_done.trim()}>
            {saving ? 'Salvando...' : 'Salvar DayLog'}
          </Button>
        </div>
      </form>
    </Layout>
  );
}