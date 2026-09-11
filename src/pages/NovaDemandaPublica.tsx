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
import { Loader2, CheckCircle2, Paperclip, X } from "lucide-react";
import { AnimatedLogo } from "@/components/AnimatedLogo";

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
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

// Limite do lado do cliente para o anexo opcional. Mantido em sincronia com
// o limite (em base64) validado na Edge Function demanda-publica.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB

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
          <CardTitle>Nova demanda{companyName ? ` - ${companyName}` : ""}</CardTitle>
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
              <div className="space-y-2">
                <Label htmlFor="anexo">Anexo (opcional)</Label>
                {attachmentFile ? (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
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
                  <Input id="anexo" type="file" onChange={handleFileChange} />
                )}
                <p className="text-xs text-muted-foreground">
                  Até 5MB. Pode anexar mais arquivos depois, pelo link de acompanhamento.
                </p>
              </div>
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
                {categorias.find((c) => c.id === categoryId)?.name || "(sem categoria)"}
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
              {attachmentFile && (
                <p>
                  <span className="text-muted-foreground">Anexo:</span> {attachmentFile.name}
                </p>
              )}
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
