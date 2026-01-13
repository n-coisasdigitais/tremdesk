import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleDriveRequest {
  action: "create_company_folder" | "create_demand_folder" | "share_folder" | "upload_file";
  company_id?: string;
  company_name?: string;
  demand_id?: string;
  demand_title?: string;
  folder_id?: string;
  email?: string;
  file_name?: string;
  file_type?: string;
  file_content?: string; // base64 encoded
}

// Get access token using service account credentials
async function getAccessToken(serviceAccountKey: string): Promise<string> {
  console.log("=== Iniciando obtenção de Access Token ===");
  
  let credentials;
  try {
    credentials = JSON.parse(serviceAccountKey);
    console.log("Service Account Email:", credentials.client_email);
    console.log("Project ID:", credentials.project_id);
  } catch (e) {
    console.error("Erro ao fazer parse do Service Account Key:", e);
    throw new Error("Service Account Key inválida - não é um JSON válido");
  }
  
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // Encode JWT
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const claimB64 = btoa(JSON.stringify(claim)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const unsignedJwt = `${headerB64}.${claimB64}`;

  // Import private key and sign
  const pemContents = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(unsignedJwt)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${unsignedJwt}.${signatureB64}`;

  // Exchange JWT for access token
  console.log("Solicitando access token ao Google...");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  
  if (!tokenData.access_token) {
    console.error("Falha ao obter token - resposta:", tokenData);
    throw new Error("Failed to get access token: " + JSON.stringify(tokenData));
  }

  console.log("Access token obtido com sucesso!");
  return tokenData.access_token;
}

// Verify if folder is in a Shared Drive
async function verifyFolderInfo(accessToken: string, folderId: string): Promise<{
  isSharedDrive: boolean;
  driveId?: string;
  name?: string;
  parents?: string[];
}> {
  console.log(`=== Verificando informações da pasta: ${folderId} ===`);
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,parents,driveId,teamDriveId&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Erro ao verificar pasta:", error);
    return { isSharedDrive: false };
  }

  const data = await response.json();
  console.log("Informações da pasta:", JSON.stringify(data, null, 2));
  
  return {
    isSharedDrive: !!(data.driveId || data.teamDriveId),
    driveId: data.driveId || data.teamDriveId,
    name: data.name,
    parents: data.parents,
  };
}

// Create a folder in Google Drive (with Shared Drive support)
async function createFolder(
  accessToken: string, 
  name: string, 
  parentId?: string
): Promise<{ id: string; webViewLink: string }> {
  console.log(`=== Criando pasta: "${name}" ===`);
  console.log(`Parent ID: ${parentId || 'root'}`);
  
  // Verificar se o parent é um Shared Drive
  let isSharedDrive = false;
  if (parentId) {
    const parentInfo = await verifyFolderInfo(accessToken, parentId);
    isSharedDrive = parentInfo.isSharedDrive;
    console.log(`Parent é Shared Drive: ${isSharedDrive}`);
  }

  const metadata: any = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  // URL com suporte a Shared Drives
  const url = "https://www.googleapis.com/drive/v3/files?fields=id,webViewLink&supportsAllDrives=true";

  console.log("Enviando request para criar pasta...");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Erro ao criar pasta - Status:", response.status);
    console.error("Erro detalhado:", error);
    throw new Error(`Failed to create folder: ${error}`);
  }

  const data = await response.json();
  console.log(`Pasta criada com sucesso! ID: ${data.id}`);
  return data;
}

// Upload a file to Google Drive (with Shared Drive support)
async function uploadFile(
  accessToken: string,
  fileName: string,
  fileType: string,
  fileContent: string, // base64 encoded
  parentId: string
): Promise<{ id: string; webViewLink: string; webContentLink: string }> {
  console.log(`=== Iniciando upload de arquivo ===`);
  console.log(`Arquivo: ${fileName}`);
  console.log(`Tipo: ${fileType}`);
  console.log(`Pasta destino: ${parentId}`);
  console.log(`Tamanho do conteúdo base64: ${fileContent.length} caracteres`);
  
  // Verificar se a pasta é um Shared Drive
  const parentInfo = await verifyFolderInfo(accessToken, parentId);
  console.log(`Pasta destino é Shared Drive: ${parentInfo.isSharedDrive}`);
  if (parentInfo.driveId) {
    console.log(`Drive ID: ${parentInfo.driveId}`);
  }

  // Metadata for the file
  const metadata: any = {
    name: fileName,
    parents: [parentId],
  };

  // Create multipart request body
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";

  const metadataString = JSON.stringify(metadata);
  
  // Build multipart body manually
  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    metadataString +
    delimiter +
    `Content-Type: ${fileType || 'application/octet-stream'}\r\n` +
    "Content-Transfer-Encoding: base64\r\n\r\n"
  );
  const closePart = encoder.encode(closeDelimiter);
  const contentPart = encoder.encode(fileContent);

  // Combine all parts
  const body = new Uint8Array(metadataPart.length + contentPart.length + closePart.length);
  body.set(metadataPart, 0);
  body.set(contentPart, metadataPart.length);
  body.set(closePart, metadataPart.length + contentPart.length);

  console.log(`Tamanho total do body: ${body.length} bytes`);

  // URL com suporte a Shared Drives
  const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink&supportsAllDrives=true";
  
  console.log("Enviando request de upload...");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: body,
  });

  console.log(`Status da resposta: ${response.status}`);

  if (!response.ok) {
    const error = await response.text();
    console.error("=== ERRO NO UPLOAD ===");
    console.error("Status:", response.status);
    console.error("Erro completo:", error);
    
    // Parse para melhor diagnóstico
    try {
      const errorJson = JSON.parse(error);
      console.error("Código do erro:", errorJson.error?.code);
      console.error("Mensagem:", errorJson.error?.message);
      console.error("Razão:", errorJson.error?.errors?.[0]?.reason);
      console.error("Domínio:", errorJson.error?.errors?.[0]?.domain);
    } catch (e) {
      // Não é JSON
    }
    
    throw new Error(`Failed to upload file: ${error}`);
  }

  const data = await response.json();
  console.log(`Upload concluído com sucesso! File ID: ${data.id}`);
  
  // Make the file accessible via link (with Shared Drive support)
  console.log("Configurando permissões de leitura pública...");
  const permResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${data.id}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "anyone",
        role: "reader",
      }),
    }
  );

  if (!permResponse.ok) {
    const permError = await permResponse.text();
    console.warn("Aviso: Não foi possível configurar permissões públicas:", permError);
  } else {
    console.log("Permissões configuradas com sucesso!");
  }

  return data;
}

// Share a folder with an email
async function shareFolder(
  accessToken: string,
  folderId: string,
  email: string,
  role: "reader" | "writer" = "writer"
): Promise<void> {
  console.log(`Sharing folder ${folderId} with ${email} as ${role}`);

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "user",
        role,
        emailAddress: email,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    // Ignore if user already has access
    if (!error.includes("already has access")) {
      console.error("Share folder error:", error);
      throw new Error(`Failed to share folder: ${error}`);
    }
  }

  console.log(`Folder shared successfully`);
}

// Get folder by name in parent (with Shared Drive support)
async function findFolder(
  accessToken: string,
  name: string,
  parentId: string
): Promise<string | null> {
  console.log(`Buscando pasta "${name}" em ${parentId}...`);
  
  const query = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Erro ao buscar pasta:", error);
    return null;
  }

  const data = await response.json();
  const foundId = data.files?.[0]?.id || null;
  console.log(`Resultado da busca: ${foundId ? `Encontrada (ID: ${foundId})` : 'Não encontrada'}`);
  return foundId;
}

// Get or create demand folder
async function getOrCreateDemandFolder(
  accessToken: string,
  supabase: any,
  demandId: string,
  companyId: string,
  rootFolderId: string
): Promise<{ folderId: string; folderUrl: string }> {
  console.log("=== getOrCreateDemandFolder ===");
  console.log(`Demand ID: ${demandId}`);
  console.log(`Company ID: ${companyId}`);
  console.log(`Root Folder ID: ${rootFolderId}`);
  
  // Verificar se a pasta root é um Shared Drive
  const rootInfo = await verifyFolderInfo(accessToken, rootFolderId);
  console.log(`Root é Shared Drive: ${rootInfo.isSharedDrive}`);
  
  // Get company info
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("name, google_drive_folder_id")
    .eq("id", companyId)
    .single();

  if (companyError || !company) {
    console.error("Erro ao buscar empresa:", companyError);
    throw new Error("Company not found");
  }

  console.log(`Empresa: ${company.name}`);
  console.log(`Pasta da empresa no banco: ${company.google_drive_folder_id || 'NÃO DEFINIDA'}`);

  // Get ticket info
  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("title")
    .eq("id", demandId)
    .single();

  console.log(`Ticket: ${ticket?.title || 'Não encontrado'}`);

  let companyFolderId = company.google_drive_folder_id;

  // Verificar se a pasta da empresa existe e está acessível
  if (companyFolderId) {
    console.log(`Verificando se pasta da empresa (${companyFolderId}) ainda existe...`);
    const companyFolderInfo = await verifyFolderInfo(accessToken, companyFolderId);
    
    if (!companyFolderInfo.name) {
      console.warn("ATENÇÃO: Pasta da empresa não encontrada ou inacessível! Será recriada.");
      companyFolderId = null;
    } else {
      console.log(`Pasta da empresa encontrada: ${companyFolderInfo.name}`);
      
      // Verificar se a pasta está no mesmo drive que o root
      if (rootInfo.isSharedDrive && !companyFolderInfo.isSharedDrive) {
        console.warn("ATENÇÃO: Pasta da empresa está em drive diferente do configurado! Será recriada.");
        companyFolderId = null;
      }
    }
  }

  // Create company folder if it doesn't exist
  if (!companyFolderId) {
    console.log("Criando pasta da empresa...");
    const companyFolder = await createFolder(accessToken, company.name, rootFolderId);
    companyFolderId = companyFolder.id;

    console.log(`Atualizando pasta da empresa no banco: ${companyFolderId}`);
    await supabase
      .from("companies")
      .update({ google_drive_folder_id: companyFolderId })
      .eq("id", companyId);
  }

  // Find or create "Demandas" folder
  console.log("Buscando pasta Demandas...");
  let demandasFolderId = await findFolder(accessToken, "Demandas", companyFolderId);
  
  if (!demandasFolderId) {
    console.log("Criando pasta Demandas...");
    const demandasFolder = await createFolder(accessToken, "Demandas", companyFolderId);
    demandasFolderId = demandasFolder.id;
  }

  // Find or create demand folder
  const demandFolderName = `DEM-${demandId.substring(0, 8).toUpperCase()} - ${ticket?.title || 'Demanda'}`;
  console.log(`Buscando pasta da demanda: ${demandFolderName}`);
  let demandFolderId = await findFolder(accessToken, demandFolderName, demandasFolderId);

  if (!demandFolderId) {
    console.log("Criando pasta da demanda...");
    const demandFolder = await createFolder(accessToken, demandFolderName, demandasFolderId);
    demandFolderId = demandFolder.id;
  }

  console.log(`Pasta da demanda final: ${demandFolderId}`);
  
  return {
    folderId: demandFolderId,
    folderUrl: `https://drive.google.com/drive/folders/${demandFolderId}`,
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  GOOGLE DRIVE FOLDERS - EDGE FUNCTION INICIADA            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get settings from database
    console.log("\n=== CARREGANDO CONFIGURAÇÕES ===");
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["google_service_account_key", "google_drive_root_folder_id", "google_service_account_email"]);

    if (settingsError) {
      console.error("Erro ao carregar configurações:", settingsError);
      throw new Error("Failed to fetch settings");
    }

    const settingsMap = Object.fromEntries(settings?.map(s => [s.key, s.value]) || []);
    const serviceAccountKey = settingsMap["google_service_account_key"];
    const rootFolderId = settingsMap["google_drive_root_folder_id"];
    const serviceAccountEmail = settingsMap["google_service_account_email"];

    console.log("Configurações carregadas:");
    console.log(`  - Service Account Email (config): ${serviceAccountEmail || 'NÃO DEFINIDO'}`);
    console.log(`  - Service Account Key: ${serviceAccountKey ? 'PRESENTE (' + serviceAccountKey.length + ' chars)' : 'AUSENTE'}`);
    console.log(`  - Root Folder ID: ${rootFolderId || 'NÃO DEFINIDO'}`);

    if (!serviceAccountKey) {
      console.error("ERRO: Service Account Key não configurada!");
      return new Response(
        JSON.stringify({ error: "Google Drive não configurado. Configure a Service Account nas configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rootFolderId) {
      console.error("ERRO: Root Folder ID não configurado!");
      return new Response(
        JSON.stringify({ error: "ID da pasta raiz do Google Drive não configurado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: GoogleDriveRequest = await req.json();
    console.log("\n=== REQUEST RECEBIDO ===");
    console.log(`Action: ${body.action}`);
    console.log(`Company ID: ${body.company_id || 'N/A'}`);
    console.log(`Demand ID: ${body.demand_id || 'N/A'}`);
    console.log(`File Name: ${body.file_name || 'N/A'}`);
    console.log(`File Content: ${body.file_content ? 'PRESENTE (' + body.file_content.length + ' chars)' : 'AUSENTE'}`);

    // Get access token
    console.log("\n=== AUTENTICAÇÃO ===");
    const accessToken = await getAccessToken(serviceAccountKey);

    // Verificar se a pasta root é acessível
    console.log("\n=== VERIFICANDO PASTA ROOT ===");
    const rootInfo = await verifyFolderInfo(accessToken, rootFolderId);
    if (!rootInfo.name) {
      console.error("ERRO CRÍTICO: Não foi possível acessar a pasta root!");
      console.error("Verifique se:");
      console.error("  1. O ID da pasta está correto");
      console.error("  2. A Service Account tem acesso à pasta");
      console.error("  3. Se é um Shared Drive, a Service Account foi adicionada como membro");
      return new Response(
        JSON.stringify({ 
          error: "Não foi possível acessar a pasta root do Google Drive. Verifique as permissões.",
          rootFolderId,
          details: "A Service Account não tem acesso a esta pasta"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Pasta root acessível: ${rootInfo.name}`);
    console.log(`É Shared Drive: ${rootInfo.isSharedDrive}`);

    let result: any = {};

    switch (body.action) {
      case "create_company_folder": {
        if (!body.company_id || !body.company_name) {
          throw new Error("company_id and company_name are required");
        }

        // Check if folder already exists
        let companyFolderId = await findFolder(accessToken, body.company_name, rootFolderId);
        
        if (!companyFolderId) {
          // Create company folder
          const companyFolder = await createFolder(accessToken, body.company_name, rootFolderId);
          companyFolderId = companyFolder.id;
        }

        // Create "Demandas" subfolder if it doesn't exist
        let demandasFolderId = await findFolder(accessToken, "Demandas", companyFolderId);
        
        if (!demandasFolderId) {
          const demandasFolder = await createFolder(accessToken, "Demandas", companyFolderId);
          demandasFolderId = demandasFolder.id;
        }

        // Update company with folder ID
        const { error: updateError } = await supabase
          .from("companies")
          .update({ google_drive_folder_id: companyFolderId })
          .eq("id", body.company_id);

        if (updateError) {
          console.error("Error updating company:", updateError);
        }

        result = {
          company_folder_id: companyFolderId,
          demandas_folder_id: demandasFolderId,
          folder_url: `https://drive.google.com/drive/folders/${companyFolderId}`,
        };
        break;
      }

      case "create_demand_folder": {
        if (!body.demand_id || !body.demand_title || !body.company_id) {
          throw new Error("demand_id, demand_title, and company_id are required");
        }

        // Get company info
        const { data: company, error: companyError } = await supabase
          .from("companies")
          .select("name, google_drive_folder_id")
          .eq("id", body.company_id)
          .single();

        if (companyError || !company) {
          throw new Error("Company not found");
        }

        let companyFolderId = company.google_drive_folder_id;

        // Create company folder if it doesn't exist
        if (!companyFolderId) {
          const companyFolder = await createFolder(accessToken, company.name, rootFolderId);
          companyFolderId = companyFolder.id;

          await supabase
            .from("companies")
            .update({ google_drive_folder_id: companyFolderId })
            .eq("id", body.company_id);
        }

        // Find or create "Demandas" folder
        let demandasFolderId = await findFolder(accessToken, "Demandas", companyFolderId);
        
        if (!demandasFolderId) {
          const demandasFolder = await createFolder(accessToken, "Demandas", companyFolderId);
          demandasFolderId = demandasFolder.id;
        }

        // Create demand folder with format "DEM-XXX - Title"
        const demandFolderName = `DEM-${body.demand_id.substring(0, 8).toUpperCase()} - ${body.demand_title}`;
        const demandFolder = await createFolder(accessToken, demandFolderName, demandasFolderId);

        result = {
          demand_folder_id: demandFolder.id,
          folder_url: demandFolder.webViewLink || `https://drive.google.com/drive/folders/${demandFolder.id}`,
        };
        break;
      }

      case "upload_file": {
        if (!body.demand_id || !body.company_id || !body.file_name || !body.file_content) {
          throw new Error("demand_id, company_id, file_name, and file_content are required");
        }

        console.log("\n=== INICIANDO PROCESSO DE UPLOAD ===");
        
        // Get or create the demand folder
        const { folderId, folderUrl } = await getOrCreateDemandFolder(
          accessToken,
          supabase,
          body.demand_id,
          body.company_id,
          rootFolderId
        );

        console.log(`\nPasta da demanda pronta: ${folderId}`);
        console.log("Iniciando upload do arquivo...");

        // Upload the file
        const uploadedFile = await uploadFile(
          accessToken,
          body.file_name,
          body.file_type || "application/octet-stream",
          body.file_content,
          folderId
        );

        result = {
          file_id: uploadedFile.id,
          file_url: uploadedFile.webViewLink || `https://drive.google.com/file/d/${uploadedFile.id}/view`,
          folder_id: folderId,
          folder_url: folderUrl,
        };
        break;
      }

      case "share_folder": {
        if (!body.folder_id || !body.email) {
          throw new Error("folder_id and email are required");
        }

        await shareFolder(accessToken, body.folder_id, body.email);
        result = { success: true };
        break;
      }

      default:
        throw new Error("Invalid action");
    }

    console.log("\n=== RESULTADO FINAL ===");
    console.log(JSON.stringify(result, null, 2));
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║  OPERAÇÃO CONCLUÍDA COM SUCESSO                           ║");
    console.log("╚════════════════════════════════════════════════════════════╝");

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("\n╔════════════════════════════════════════════════════════════╗");
    console.error("║  ERRO NA OPERAÇÃO                                         ║");
    console.error("╚════════════════════════════════════════════════════════════╝");
    console.error("Mensagem:", error.message);
    console.error("Stack:", error.stack);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
