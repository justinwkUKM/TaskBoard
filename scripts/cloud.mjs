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
  console.log(JSON.stringify({ name: config.name, authorizedDomains: config.authorizedDomains, email: config.signIn?.email }, null, 2));
  const providers = await request(`${base}/defaultSupportedIdpConfigs`);
  console.log(JSON.stringify({ providers: providers.defaultSupportedIdpConfigs?.map(p => ({ name: p.name, enabled: p.enabled, hasClientId: Boolean(p.clientId) })) }));
}
if (mode === 'enable-email-link') {
  const updated = await request(`${base}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`, 'PATCH', { signIn: { email: { enabled: true, passwordRequired: false } } });
  console.log(JSON.stringify({ project, email: updated.signIn?.email }));
}
if (mode === 'enable-google') {
  try { await request(`https://identitytoolkit.googleapis.com/v2/projects/${project}/identityPlatform:initializeAuth`, 'POST'); } catch (error) { if (!String(error).includes('already')) throw error; }
  try { await request(`${base}/defaultSupportedIdpConfigs?idpId=google.com`, 'POST', { enabled: true }); } catch (error) {
    if (!String(error).includes('ALREADY_EXISTS')) throw error;
    await request(`${base}/defaultSupportedIdpConfigs/google.com`, 'PATCH', { enabled: true },);
  }
  console.log(`Google provider configured for ${project}`);
}
if (mode === 'add-domain') {
  const domainToAdd = process.argv[4];
  if (!domainToAdd) throw new Error('Specify domain to add');
  const cleanDomain = domainToAdd.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const config = await request(`${base}/config`);
  const currentDomains = config.authorizedDomains || [];
  const updatedDomains = Array.from(new Set([...currentDomains, cleanDomain]));
  const updated = await request(`${base}/config?updateMask=authorizedDomains`, 'PATCH', { authorizedDomains: updatedDomains });
  console.log(`Updated authorizedDomains for ${project}:`, updated.authorizedDomains);
}
