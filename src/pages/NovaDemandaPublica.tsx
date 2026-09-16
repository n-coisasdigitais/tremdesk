import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FolderUp,
  Loader2,
  Mail,
  Paperclip,
  Send,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { StaticLogo } from "@/components/AnimatedLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// As categorias nao sao mais uma lista fixa no codigo: vem de
// ticket_categories (Admin > Categorias), buscadas junto com a empresa em
// resolverEmpresa(). Quem cadastra/edita categorias no painel administrativo
// ve o reflexo aqui, sem precisar de outro deploy.
interface CategoriaPublica {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

const PRIORITIES = [
  { value: "baixa", label: "Baixa", dot: "bg-status-new" },
  { value: "media", label: "Média", dot: "bg-status-progress" },
  { value: "alta", label: "Alta", dot: "bg-status-waiting" },
  { value: "urgente", label: "Urgente", dot: "bg-status-cancelled" },
];

// Limite do lado do cliente para o anexo opcional. Mantido em sincronia com
// o limite (em base64) validado na Edge Function demanda-publica.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { number: 1 as Step, label: "Identificação", icon: UserRound },
  { number: 2 as Step, label: "Classificação", icon: Tag },
  { number: 3 as Step, label: "Detalhes", icon: FileText },
  { number: 4 as Step, label: "Revisão", icon: ClipboardCheck },
];

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function NovaDemandaPublica() {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("e") || "";
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [loadingEmpresa, setLoadingEmpresa] = useState(true);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<{ protocolo: string; tracking_url: string } | null>(null);

  const [categorias, setCategorias] = useState<CategoriaPublica[]>([]);
  const [categoryId, setCategoryId] = useState("");

  const [solicitanteNome, setSolicitanteNome] = useState("");
  const [solicitanteEmail, setSolicitanteEmail] = useState("");
  const [priority, setPriority] = useState("media");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    const resolverEmpresa = async () => {
      if (!slug) {
        setLinkInvalido(true);
        setLoadingEmpresa(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("demanda-publica", {
        body: { action: "resolver_empresa", slug },
      });
      if (error || data?.error || !data?.company_name) {
        setLinkInvalido(true);
      } else {
        setCompanyName(data.company_name);
        setCompanyLogoUrl(data.company_logo_url || null);
        setCategorias(data.categories || []);
      }
      setLoadingEmpresa(false);
    };
    resolverEmpresa();
  }, [slug]);

  const podeAvancarEtapa1 = solicitanteNome.trim() && solicitanteEmail.trim();
  // Se por algum motivo nao houver nenhuma categoria ativa cadastrada em
  // Admin > Categorias, nao trava o formulario: a demanda so segue sem
  // categoria (pode ser categorizada depois, no painel interno).
  const podeAvancarEtapa2 = categorias.length === 0 || !!categoryId;
  const podeEnviar = title.trim() && description.trim();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      toast({
        title: "Arquivo muito grande",
        description:
          "O limite atual é 5MB. Envie um arquivo menor, ou anexe depois pelo link de acompanhamento que você vai receber por e-mail.",
        variant: "destructive",
      });
      e.target.value = "";
      setAttachmentFile(null);
      return;
    }
    setAttachmentFile(file);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let attachment: { file_name: string; file_type: string; file_base64: string } | undefined;
      if (attachmentFile) {
        const file_base64 = await fileToBase64(attachmentFile);
        attachment = {
          file_name: attachmentFile.name,
          file_type: attachmentFile.type,
          file_base64,
        };
      }

      const { data, error } = await supabase.functions.invoke("demanda-publica", {
        body: {
          action: "criar",
          slug,
          solicitante_nome: solicitanteNome,
          solicitante_email: solicitanteEmail,
          category_id: categoryId || undefined,
          priority,
          title,
          description,
          attachment,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao registrar demanda");
      }

      setResultado(data);
    } catch (err: any) {
      toast({
        title: "Erro ao enviar demanda",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingEmpresa) {
    return (
      <CenteredShell>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CenteredShell>
    );
  }

  if (linkInvalido) {
    return (
      <CenteredShell>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link inválido</CardTitle>
            <CardDescription>
              Este link de abertura de demanda não é válido. Confira o link recebido ou entre em contato para receber um
              novo.
            </CardDescription>
          </CardHeader>
        </Card>
      </CenteredShell>
    );
  }

  if (resultado) {
    return (
      <CenteredShell>
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-status-approved/10">
              <CheckCircle2 className="h-6 w-6 text-status-approved" />
            </div>
            <CardTitle>Demanda registrada</CardTitle>
            <CardDescription>
              Protocolo <strong>{resultado.protocolo}</strong>. Você vai receber um e-mail em{" "}
              <strong>{solicitanteEmail}</strong> com o link de acompanhamento.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href={resultado.tracking_url}>Ver andamento agora</a>
            </Button>
          </CardContent>
        </Card>
      </CenteredShell>
    );
  }

  const selectedCategory = categorias.find((category) => category.id === categoryId);
  const selectedPriority = PRIORITIES.find((item) => item.value === priority);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <StaticLogo size="sm" />
          <div className="flex min-w-0 items-center gap-3 border-l pl-4">
            <div className="min-w-0 text-right">
              <p className="text-[11px] font-medium uppercase text-muted-foreground">Portal de atendimento</p>
              <p className="truncate text-sm font-semibold">{companyName}</p>
            </div>
            <Avatar className="h-10 w-10 rounded-md border bg-background">
              <AvatarImage className="object-contain p-1" src={companyLogoUrl || undefined} alt={`Logo ${companyName}`} />
              <AvatarFallback className="rounded-md text-xs font-semibold">
                {companyName ? initials(companyName) : <Building2 className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Nova solicitação</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Abrir uma nova demanda</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Envie sua solicitação para {companyName}. Ao concluir, você receberá o protocolo e o link de acompanhamento.
          </p>
        </section>

        <section aria-label="Etapas do formulário" className="mb-6 overflow-x-auto border-y bg-card px-2 py-5 sm:px-5">
          <div className="flex min-w-[620px] items-start">
            {STEPS.map((item, index) => {
              const Icon = item.icon;
              const complete = item.number < step;
              const active = item.number === step;
              return (
                <div key={item.number} className="relative flex flex-1 flex-col items-center text-center">
                  {index > 0 && <div className={cn("absolute right-1/2 top-4 h-0.5 w-full", item.number <= step ? "bg-primary" : "bg-border")} />}
                  <div className={cn("relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-card", (complete || active) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
                    {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={cn("mt-2 text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">{(() => { const Icon = STEPS[step - 1].icon; return <Icon className="h-4 w-4" />; })()}</div>
                <div>
                  <CardTitle className="text-lg">{STEPS[step - 1].label}</CardTitle>
                  <CardDescription>Etapa {step} de {STEPS.length}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
          {step === 1 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                <Label htmlFor="nome">Seu nome *</Label>
                  <div className="relative"><UserRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" id="nome" value={solicitanteNome} onChange={(e) => setSolicitanteNome(e.target.value)} placeholder="Nome completo" /></div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Seu e-mail *</Label>
                  <div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" id="email" type="email" value={solicitanteEmail} onChange={(e) => setSolicitanteEmail(e.target.value)} placeholder="voce@empresa.com" /></div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">O protocolo, as movimentações e o acesso ao acompanhamento serão enviados para este e-mail.</p>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                <Label>Categoria {categorias.length > 0 ? "*" : ""}</Label>
                <Select value={categoryId} onValueChange={setCategoryId} disabled={categorias.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={categorias.length > 0 ? "Selecione" : "Nenhuma categoria disponível"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ""}
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}><span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", p.dot)} />{p.label}</span></SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Ajustar campanha Black Friday"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="O que precisa, contexto, urgência se houver..."
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anexo">Anexo (opcional)</Label>
                {attachmentFile ? (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-3 text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{attachmentFile.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        ({(attachmentFile.size / 1024).toFixed(0)} KB)
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => setAttachmentFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label htmlFor="anexo" className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-4 text-center transition-colors hover:bg-muted/40">
                    <FolderUp className="mb-2 h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium">Escolher arquivo</span>
                    <span className="mt-1 text-xs text-muted-foreground">O arquivo será salvo na pasta desta demanda no Google Drive.</span>
                    <Input className="sr-only" id="anexo" type="file" onChange={handleFileChange} />
                  </label>
                )}
                <p className="text-xs text-muted-foreground">Até 5MB.</p>
              </div>
            </>
          )}

          {step === 4 && (
            <div className="space-y-5 text-sm">
              <div className="flex flex-wrap gap-2">
                {selectedCategory && <Badge variant="secondary">{selectedCategory.icon} {selectedCategory.name}</Badge>}
                {selectedPriority && <Badge variant="outline" className="gap-2"><span className={cn("h-2 w-2 rounded-full", selectedPriority.dot)} />{selectedPriority.label}</Badge>}
              </div>
              <div><p className="text-xs font-medium uppercase text-muted-foreground">Solicitante</p><p className="mt-1 font-medium">{solicitanteNome}</p><p className="text-muted-foreground">{solicitanteEmail}</p></div>
              <div className="border-t pt-4"><p className="text-xs font-medium uppercase text-muted-foreground">Demanda</p><p className="mt-1 text-base font-semibold">{title}</p><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{description}</p></div>
              {attachmentFile && (
                <div className="flex items-center gap-2 border-t pt-4"><Paperclip className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{attachmentFile.name}</span></div>
              )}
            </div>
          )}

          <div className="flex justify-between border-t pt-5">
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)} disabled={step === 1}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            {step < 4 ? (
              <Button
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={(step === 1 && !podeAvancarEtapa1) || (step === 2 && !podeAvancarEtapa2)}
              >
                Avançar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!podeEnviar || submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : <><Send className="mr-2 h-4 w-4" />Enviar demanda</>}
              </Button>
            )}
          </div>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Empresa</p><p className="font-medium">{companyName}</p></div>
                <div><p className="text-xs text-muted-foreground">Solicitante</p><p className="truncate font-medium">{solicitanteNome || "A preencher"}</p></div>
                <div><p className="text-xs text-muted-foreground">Categoria</p><p className="font-medium">{selectedCategory?.name || "A definir"}</p></div>
                <div><p className="text-xs text-muted-foreground">Prioridade</p><p className="flex items-center gap-2 font-medium"><span className={cn("h-2 w-2 rounded-full", selectedPriority?.dot)} />{selectedPriority?.label}</p></div>
                {attachmentFile && <div><p className="text-xs text-muted-foreground">Anexo</p><p className="truncate font-medium">{attachmentFile.name}</p></div>}
              </CardContent>
            </Card>
            <div className="flex gap-3 border-y bg-card px-4 py-4 text-sm text-muted-foreground"><FolderUp className="mt-0.5 h-4 w-4 shrink-0" /><p>Anexos são organizados automaticamente na pasta da demanda no Google Drive.</p></div>
          </aside>
        </div>
      </main>
      <footer className="mt-8 border-t bg-card py-5 text-center text-xs text-muted-foreground">Atendimento por N Coisas Digitais</footer>
    </div>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4 bg-background">
      <StaticLogo />
      {children}
    </div>
  );
}
