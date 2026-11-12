/* AA Plug 2 MCP — 도구 정의. 설명은 호스트 AI 가 언제·어떻게 부를지 알 수 있게 쓴다. */
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as E from './engine.mjs';
import { CFG } from './runtime.mjs';

export const VERSION = '0.1.0';

export const INSTRUCTIONS = `AA Plug 2 (by ${CFG.operator}) helps people who already built an Android and/or iOS app with AI get it published on Google Play and the App Store, and stops at launch.
How to use it:
1. When the user says their app is finished or asks for help publishing, call aaplug2_connect_app ONCE with a public GitHub URL, a local folder/ZIP path, or source=sample for a demo. Never ask the user for tokens, passwords or store metadata forms.
2. Show the analysis in plain words, then call aaplug2_get_decisions and present each decision's options to the user. The user only picks, approves or rejects. Show the recommended option first.
3. Call aaplug2_decide ONLY with values the user actually chose in this conversation. Use accept_all_recommended=true only if the user explicitly says to accept all recommendations.
4. Call aaplug2_generate_store_materials, then aaplug2_submission_guide for each store and walk the user through the console steps.
5. The final submit step stays locked until the user explicitly approves; then call aaplug2_approve_submission. AA Plug 2 never submits to any store itself: the user presses the submit button in Play Console / App Store Connect.
6. When the user reports the review result, call aaplug2_report_review (submitted / rejected with the store's message / resubmitted / approved). When every chosen store is live, the job is done.
Reply to the user in their language. Tool texts come in ko (default), en or th via the lang argument. Free to use; feedback: ${CFG.feedbackEmail}.`;

const lang = z.enum(['ko', 'en', 'th']).optional().describe('Language for texts in the result: ko (default), en, th. Use the user\'s language.');
const pid = z.string().describe('project_id returned by aaplug2_connect_app');
const store = z.enum(['play', 'apple']).describe('play = Google Play, apple = App Store');

const json = o => JSON.stringify(o, (k, v) => (k.startsWith('_') ? undefined : v), 2);
const ok = (o, extra = []) => ({ content: [{ type: 'text', text: json(o) }, ...extra] });
const fail = e => ({ isError: true, content: [{ type: 'text', text: (e && e.message) || String(e) }] });
const wrap = fn => async (args) => { try { return await fn(args || {}); } catch (e) { if (!(e instanceof E.UserError)) console.error('[aaplug2]', e); return fail(e); } };

export function createServer({ allowPath = true, inlineZip = false } = {}) {
  const server = new McpServer({ name: 'aaplug2', title: 'AA Plug 2', version: VERSION }, { instructions: INSTRUCTIONS });
  const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const W = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

  server.registerTool('aaplug2_connect_app', {
    title: 'Connect an app (start launch help)',
    description: 'Start here when the user has finished building an Android or iOS app and wants to publish it, or asks for Play Store / App Store launch help. Connects the app project once and analyzes it (manifest, Gradle, Info.plist, strings, README, icons, screenshots) for store-review problems and launch readiness. No tokens or forms. source: "github" (public repo URL), "path" (a project folder or .zip on the machine running this server), or "sample" (built-in demo app SnapLedger). Returns project_id used by every other AA Plug 2 tool.',
    inputSchema: {
      source: z.enum(['github', 'path', 'sample']).describe('Where the app comes from'),
      github_url: z.string().optional().describe('Public GitHub repo URL, e.g. https://github.com/owner/repo (optionally /tree/branch/subfolder). Required when source=github'),
      path: z.string().optional().describe('Absolute path to the project folder or a .zip of it, on the computer running this MCP server. Required when source=path'),
      lang
    },
    annotations: { ...W, openWorldHint: true }
  }, wrap(async a => ok((await E.connect(a, { allowPath })).report)));

  server.registerTool('aaplug2_get_report', {
    title: 'Show the analysis report',
    description: 'Show the analysis of a connected app again: launch readiness, every issue that can block store review with a plain-language reason, and what AA Plug 2 can fix.',
    inputSchema: { project_id: pid, lang }, annotations: RO
  }, wrap(async a => ok(E.report(E.load(a.project_id, a.lang), a.lang))));

  server.registerTool('aaplug2_get_decisions', {
    title: 'List choices for the user',
    description: 'List what the user needs to decide, each with ready-made options and a recommended one: code fixes to apply or skip, which stores, store title, short description, tone, category, store languages, icon, feature graphic, screenshots, privacy policy, Data safety / App Privacy answers, content rating answers and release track. Present these to the user as simple choices; the user does not type metadata. Use only_open=true to see just the undecided ones.',
    inputSchema: { project_id: pid, only_open: z.boolean().optional().describe('Only undecided items (default true)'), lang }, annotations: RO
  }, wrap(async a => ok(E.decisions(E.load(a.project_id, a.lang), a.lang, a.only_open !== false))));

  server.registerTool('aaplug2_decide', {
    title: 'Record the user\'s choices',
    description: 'Record choices the user made. Pass each as {key, value} using the key and an option value from aaplug2_get_decisions. Only send what the user actually picked or approved. Set accept_all_recommended=true only when the user explicitly said to accept all recommendations; it fills every undecided item with the recommended option. Changing a decision clears earlier submission approvals and generated files.',
    inputSchema: {
      project_id: pid,
      choices: z.array(z.object({ key: z.string(), value: z.union([z.string(), z.number(), z.array(z.string())]) })).optional().describe('e.g. [{"key":"title","value":1},{"key":"fix:targetSdk","value":"apply"},{"key":"langs","value":["ko","en"]}]'),
      accept_all_recommended: z.boolean().optional(),
      lang
    }, annotations: W
  }, wrap(async a => ok(E.decide(E.load(a.project_id, a.lang), a, a.lang))));

  server.registerTool('aaplug2_preview_graphics', {
    title: 'Show icon / feature graphic / screenshot options',
    description: 'Render the store graphics so the user can pick: kind=icons (3 icon options, 512×512), feature (3 Google Play feature graphics, 1024×500, using the chosen title and icon), screenshots (store screenshots 1080×1920 made from the app\'s own screenshots). Returns the images and the saved file paths.',
    inputSchema: { project_id: pid, kind: z.enum(['icons', 'feature', 'screenshots']), lang }, annotations: RO
  }, wrap(async a => {
    const r = await E.preview(E.load(a.project_id, a.lang), a.kind, a.lang);
    return ok({ note: r.note, images: r.images.map(i => ({ label: i.label, file: i.file })) }, r.images.map(i => ({ type: 'image', data: i.data, mimeType: 'image/png' })));
  }));

  server.registerTool('aaplug2_generate_store_materials', {
    title: 'Make all store materials',
    description: 'After every decision is made, create the full launch kit: store listing text per chosen language (KO/EN/TH), privacy policy and account-deletion pages, Data safety CSV and App Privacy answers, content-rating answers, PrivacyInfo.xcprivacy, code-fix diff for the approved fixes, icon, feature graphic and screenshots. Saves a folder and a ZIP and returns the texts so you can show them.',
    inputSchema: { project_id: pid, output_dir: z.string().optional().describe('Optional folder to save into (local stdio use only). Default: ~/.aaplug2/projects/<id>/store-materials'), lang }, annotations: W
  }, wrap(async a => {
    const r = await E.generate(E.load(a.project_id, a.lang), a, { allowPath });
    const extra = inlineZip ? [{ type: 'resource', resource: { uri: `aaplug2://${r.project_id}/store-materials.zip`, mimeType: 'application/zip', blob: r._zipBase64 } }] : [];
    return ok(r, extra);
  }));

  server.registerTool('aaplug2_submission_guide', {
    title: 'Step-by-step console guide',
    description: 'Plain-language, step-by-step guide for Google Play Console (store=play) or App Store Connect (store=apple) with the exact value to paste into every field. The final submit step stays locked until the user approves with aaplug2_approve_submission.',
    inputSchema: { project_id: pid, store, lang }, annotations: RO
  }, wrap(async a => ok(E.guide(E.load(a.project_id, a.lang), a.store, a.lang))));

  server.registerTool('aaplug2_approve_submission', {
    title: 'Record the user\'s approval to submit',
    description: 'Call only after the user explicitly approves submitting this app to the given store in this conversation (for example "yes, submit it"). Unlocks the final step of the guide. This does NOT submit anything: the user presses the submit button in the store console themselves. Pass the user\'s own words in user_confirmation.',
    inputSchema: { project_id: pid, store, user_confirmation: z.string().min(1).describe('The user\'s approval in their own words'), lang }, annotations: W
  }, wrap(async a => ok(E.approve(E.load(a.project_id, a.lang), a.store, a.user_confirmation, a.lang))));

  server.registerTool('aaplug2_report_review', {
    title: 'Report a store review result',
    description: 'Record what happened at the store, as told by the user: event=submitted (user pressed submit), rejected (include the store\'s rejection message in rejection_text to get a fix plan and a reply to the reviewer), resubmitted (after the user approved the fix and resubmitted), approved (the app is live). When every chosen store is live, AA Plug 2\'s job is finished.',
    inputSchema: { project_id: pid, store, event: z.enum(['submitted', 'rejected', 'resubmitted', 'approved']), rejection_text: z.string().optional(), lang }, annotations: W
  }, wrap(async a => ok(E.review(E.load(a.project_id, a.lang), a, a.lang))));

  server.registerTool('aaplug2_status', {
    title: 'Where am I?',
    description: 'Show the current step and the next action for a project, or list all AA Plug 2 projects when project_id is omitted. Use it to resume launch help in a new conversation.',
    inputSchema: { project_id: z.string().optional(), lang }, annotations: RO
  }, wrap(async a => ok(E.status(a.project_id, a.lang))));

  server.registerPrompt('launch_my_app', {
    title: 'Launch my app with AA Plug 2',
    description: 'Start the AA Plug 2 launch flow for an app the user already built.',
    argsSchema: { app: z.string().optional().describe('Public GitHub URL or local path of the app (leave empty for the demo)') }
  }, ({ app }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Use AA Plug 2 to get my app ready for Google Play / App Store launch${app ? `: ${app}` : ' (use the built-in sample if I have nothing to connect yet)'}. I only want to pick and approve; do not submit anything without my approval.` } }] }));

  return server;
}
