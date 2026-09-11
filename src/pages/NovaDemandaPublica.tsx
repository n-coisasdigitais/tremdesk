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
import { Loader2, CheckCircle2 } from "lucide-react";
import { AnimatedLogo } from "@/components/AnimatedLogo";

// Mesma lista do enum ticket_category usada no Kanban interno (Kanban.tsx,
// categoryIcons). Se uma categoria nova for adicionada lá, replicar aqui.
const CATEGORIES = [
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "linkedin_ads", label: "LinkedIn Ads" },
  { value: "arte", label: "Arte" },
  { value: "relatorio", label: "Relatório" },
  { value: "outro", label: "Outro" },
];

const PRIORITIES = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

type Step = 1 | 2 | 3 | 4;

export default function NovaDemandaPublica() {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("e") || "";
  const { toast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [loadingEmpresa, setLoadingEmpresa] = useState(true);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<{ protocolo: string; tracking_url: string } | null>(null);

  const [solicitanteNome, setSolicitanteNome] = useState("");
  const [solicitanteEmail, setSolicitanteEmail] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("media");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

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
      }
      setLoadingEmpresa(false);
    };
    resolverEmpresa();
  }, [slug]);

  const podeAvancarEtapa1 = solicitanteNome.trim() && solicitanteEmail.trim();
  const podeAvancarEtapa2 = !!category;
  const podeEnviar = title.trim() && description.trim();

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("demanda-publica", {
        body: {
          action: "criar",
          slug,
          solicitante_nome: solicitanteNome,
          solicitante_email: solicitanteEmail,
          category,
          priority,
          title,
          description,
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
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
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

  return (
    <CenteredShell>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Nova demanda{companyName ? ` — ${companyName}` : ""}</CardTitle>
          <CardDescription>Etapa {step} de 4</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="nome">Seu nome *</Label>
                <Input id="nome" value={solicitanteNome} onChange={(e) => setSolicitanteNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Seu e-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={solicitanteEmail}
                  onChange={(e) => setSolicitanteEmail(e.target.value)}
                  placeholder="para onde vai o protocolo e o link de acompanhamento"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              {/* Anexo fica para uma segunda iteração: reaproveitar o upload
                  de TicketAttachments.tsx exige o ticket já existir, então
                  aqui o caminho mais simples é permitir anexar depois de
                  criado, a partir do link de acompanhamento, ou pelo painel
                  interno na triagem. */}
            </>
          )}

          {step === 4 && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Empresa:</span> {companyName}
              </p>
              <p>
                <span className="text-muted-foreground">Nome:</span> {solicitanteNome}
              </p>
              <p>
                <span className="text-muted-foreground">E-mail:</span> {solicitanteEmail}
              </p>
              <p>
                <span className="text-muted-foreground">Categoria:</span>{" "}
                {CATEGORIES.find((c) => c.value === category)?.label}
              </p>
              <p>
                <span className="text-muted-foreground">Prioridade:</span>{" "}
                {PRIORITIES.find((p) => p.value === priority)?.label}
              </p>
              <p>
                <span className="text-muted-foreground">Título:</span> {title}
              </p>
              <p className="whitespace-pre-wrap">
                <span className="text-muted-foreground">Descrição:</span> {description}
              </p>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)} disabled={step === 1}>
              Voltar
            </Button>
            {step < 4 ? (
              <Button
                onClick={() => setStep((s) => (s + 1) as Step)}
                disabled={(step === 1 && !podeAvancarEtapa1) || (step === 2 && !podeAvancarEtapa2)}
              >
                Avançar
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!podeEnviar || submitting}>
                {submitting ? "Enviando..." : "Enviar demanda"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </CenteredShell>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4 bg-background">
      <AnimatedLogo />
      {children}
    </div>
  );
}
