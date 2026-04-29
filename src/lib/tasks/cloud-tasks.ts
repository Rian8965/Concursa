import { google } from "googleapis";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function normalizeLocation(loc: string) {
  return loc.trim();
}

export async function enqueueImportProcessTask(params: { importId: string }): Promise<void> {
  const projectId = requiredEnv("GOOGLE_CLOUD_PROJECT").trim();
  const location = normalizeLocation(requiredEnv("CLOUD_TASKS_LOCATION"));
  const queue = requiredEnv("CLOUD_TASKS_QUEUE").trim();
  const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
  const secret = requiredEnv("IMPORT_JOB_SECRET");

  const targetUrl = `${appUrl}/api/admin/imports/process-job`;

  const auth = await google.auth.getClient({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  google.options({ auth });

  const cloudtasks = google.cloudtasks("v2");
  const parent = `projects/${projectId}/locations/${location}/queues/${queue}`;

  const payload = JSON.stringify({ importId: params.importId });
  const body = Buffer.from(payload, "utf8").toString("base64");

  await cloudtasks.projects.locations.queues.tasks.create({
    parent,
    requestBody: {
      task: {
        httpRequest: {
          httpMethod: "POST",
          url: targetUrl,
          headers: {
            "Content-Type": "application/json",
            "X-Import-Job-Secret": secret,
          },
          body,
        },
      },
    },
  });
}

