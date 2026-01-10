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
  const credentials = JSON.parse(serviceAccountKey);
  
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
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  
  if (!tokenData.access_token) {
    console.error("Token response:", tokenData);
    throw new Error("Failed to get access token: " + JSON.stringify(tokenData));
  }

  return tokenData.access_token;
}

// Create a folder in Google Drive
async function createFolder(
  accessToken: string, 
  name: string, 
  parentId?: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata: any = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  console.log(`Creating folder: ${name} in parent: ${parentId || 'root'}`);

  const response = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Create folder error:", error);
    throw new Error(`Failed to create folder: ${error}`);
  }

  const data = await response.json();
  console.log(`Folder created: ${data.id}`);
  return data;
}

// Upload a file to Google Drive
async function uploadFile(
  accessToken: string,
  fileName: string,
  fileType: string,
  fileContent: string, // base64 encoded
  parentId: string
): Promise<{ id: string; webViewLink: string; webContentLink: string }> {
  console.log(`Uploading file: ${fileName} to folder: ${parentId}`);

  // Decode base64 content
  const binaryContent = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));

  // Metadata for the file
  const metadata = {
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

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Upload file error:", error);
    throw new Error(`Failed to upload file: ${error}`);
  }

  const data = await response.json();
  console.log(`File uploaded: ${data.id}`);
  
  // Make the file accessible via link
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${data.id}/permissions`,
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
    `https://www.googleapis.com/drive/v3/files/${folderId}/permissions`,
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

// Get folder by name in parent
async function findFolder(
  accessToken: string,
  name: string,
  parentId: string
): Promise<string | null> {
  const query = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.files?.[0]?.id || null;
}

// Get or create demand folder
async function getOrCreateDemandFolder(
  accessToken: string,
  supabase: any,
  demandId: string,
  companyId: string,
  rootFolderId: string
): Promise<{ folderId: string; folderUrl: string }> {
  // Get company info
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("name, google_drive_folder_id")
    .eq("id", companyId)
    .single();

  if (companyError || !company) {
    throw new Error("Company not found");
  }

  // Get ticket info
  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .select("title")
    .eq("id", demandId)
    .single();

  let companyFolderId = company.google_drive_folder_id;

  // Create company folder if it doesn't exist
  if (!companyFolderId) {
    const companyFolder = await createFolder(accessToken, company.name, rootFolderId);
    companyFolderId = companyFolder.id;

    await supabase
      .from("companies")
      .update({ google_drive_folder_id: companyFolderId })
      .eq("id", companyId);
  }

  // Find or create "Demandas" folder
  let demandasFolderId = await findFolder(accessToken, "Demandas", companyFolderId);
  
  if (!demandasFolderId) {
    const demandasFolder = await createFolder(accessToken, "Demandas", companyFolderId);
    demandasFolderId = demandasFolder.id;
  }

  // Find or create demand folder
  const demandFolderName = `DEM-${demandId.substring(0, 8).toUpperCase()} - ${ticket?.title || 'Demanda'}`;
  let demandFolderId = await findFolder(accessToken, demandFolderName, demandasFolderId);

  if (!demandFolderId) {
    const demandFolder = await createFolder(accessToken, demandFolderName, demandasFolderId);
    demandFolderId = demandFolder.id;
  }

  return {
    folderId: demandFolderId,
    folderUrl: `https://drive.google.com/drive/folders/${demandFolderId}`,
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== google-drive-folders edge function iniciada ===");
  
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
    console.log("Buscando configurações do sistema...");
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["google_service_account_key", "google_drive_root_folder_id"]);

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw new Error("Failed to fetch settings");
    }

    const settingsMap = Object.fromEntries(settings?.map(s => [s.key, s.value]) || []);
    const serviceAccountKey = settingsMap["google_service_account_key"];
    const rootFolderId = settingsMap["google_drive_root_folder_id"];

    console.log("Configurações encontradas:", {
      hasServiceAccountKey: !!serviceAccountKey,
      hasRootFolderId: !!rootFolderId,
      rootFolderId: rootFolderId ? rootFolderId.substring(0, 10) + "..." : null
    });

    if (!serviceAccountKey) {
      console.error("Service Account Key não encontrada!");
      return new Response(
        JSON.stringify({ error: "Google Drive não configurado. Configure a Service Account nas configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rootFolderId) {
      console.error("Root Folder ID não encontrado!");
      return new Response(
        JSON.stringify({ error: "ID da pasta raiz do Google Drive não configurado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: GoogleDriveRequest = await req.json();
    console.log("Request recebido:", {
      action: body.action,
      demand_id: body.demand_id,
      company_id: body.company_id,
      file_name: body.file_name,
      hasFileContent: !!body.file_content
    });

    // Get access token
    const accessToken = await getAccessToken(serviceAccountKey);

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

        // Get or create the demand folder
        const { folderId, folderUrl } = await getOrCreateDemandFolder(
          accessToken,
          supabase,
          body.demand_id,
          body.company_id,
          rootFolderId
        );

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

    console.log("Result:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in google-drive-folders function:", error);
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
