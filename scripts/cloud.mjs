// A small authenticated REST helper. Output deliberately excludes secrets.
import { execFileSync } from 'node:child_process';
const [project, mode = 'inspect'] = process.argv.slice(2);
if (!['taskboard-prod-260908', 'taskboard-dev-260908'].includes(project)) throw new Error('Choose a TaskBoard project.');
const accessToken = execFileSync('gcloud', ['auth', 'print-access-token', '--account=waqasobeidy@gmail.com'], { encoding: 'utf8' }).trim();
async function request(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'x-goog-user-project': project }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${result.error?.message}`);
  return result;
}
const base = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}`;
if (mode === 'inspect') {
  const config = await request(`${base}/config`);
  console.log(JSON.stringify({ name: config.name, authorizedDomains: config.authorizedDomains, signIn: config.signIn, notification: config.notification && { sendEmail: config.notification.sendEmail } }, null, 2));
  const providers = await request(`${base}/defaultSupportedIdpConfigs`);
  console.log(JSON.stringify({ providers: providers.defaultSupportedIdpConfigs?.map(p => ({ name: p.name, enabled: p.enabled, hasClientId: Boolean(p.clientId) })) }));
}
