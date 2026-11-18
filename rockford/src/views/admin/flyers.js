'use strict';
/* Job flyers: list + add/edit form. A flyer is an image, a PDF, or typed words. */
const { h } = require('../../security');
const { layout } = require('./layout');
const ui = require('./ui');
const { flyerUrl } = require('../../uploads');
const { todayColombo } = require('../../content');

// KINDS = every value the server accepts; FORM_KINDS = the two choices shown in the form.
const KINDS = [['file', 'Upload a file'], ['image', 'Image'], ['pdf', 'PDF'], ['doc', 'Word document'], ['text', 'Words only']];
const FORM_KINDS = [['file', 'Upload a file (image, PDF or Word document)'], ['text', 'Words only (typed text)']];
const KIND_LABEL = { image: 'Image', pdf: 'PDF', doc: 'Word', text: 'Words' };
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const expired = (r) => !!r.deadline && r.deadline < todayColombo();

const statusButtons = (r, s, small) => {
  const to = r.status === 'published' ? 'draft' : 'published';
  return ui.actionForm(`/admin/flyers/${r.id}/status`, to === 'published' ? 'Publish' : 'Unpublish', s, { hidden: { status: to }, cls: `btn${small ? ' btn-small' : ''}` });
};

function listPage(ctx, { rows }) {
  const s = ctx.session;
  const cols = [
    { label: 'Flyer', render: (r) => `<a href="/admin/flyers/${r.id}">${h(r.title)}</a>${r.summary ? `<br><span class="muted small">${h(r.summary)}</span>` : ''}` },
    { label: 'Type', render: (r) => ui.badge(KIND_LABEL[r.kind]) },
    { label: 'Status', render: (r) => ui.statusBadge(r.status) + (r.status === 'published' && expired(r) ? ` ${ui.badge('Closing date passed', 'muted')}` : '') },
    { label: 'Closing date', render: (r) => h(r.deadline ? ui.fmtDate(ui.fromIsoDate(r.deadline)) : '—') },
    { label: 'File', render: (r) => (r.file ? `<a href="${h(flyerUrl(r.file))}" target="_blank" rel="noopener">View</a> <span class="muted small">${h(kb(r.size))}</span>` : '<span class="muted">—</span>') },
    { label: 'Actions', render: (r) => `<div class="row-actions">${statusButtons(r, s, true)}</div>` },
  ];
  return layout(ctx, {
    title: 'Job Flyers',
    active: 'flyers',
    body: `${ui.pageHeader('Job Flyers', '<a class="btn btn-primary" href="/admin/flyers/new">Add flyer</a>', 'Job flyers shown on the Careers page. Upload an image or a PDF, or just type the words. Only published flyers are visible.')}
${ui.notices(ctx.query)}
${ui.table(cols, rows, 'No flyers yet. Click “Add flyer” to create the first one.')}`,
  });
}

/** opts: { row, values, errors, maxMb } – row is the stored record (absent for a new flyer). */
function formPage(ctx, { row, values, errors = {}, maxMb }) {
  const s = ctx.session;
  const isNew = !row;
  const v = values;
  const title = isNew ? 'Add flyer' : 'Edit flyer';
  const action = isNew ? '/admin/flyers/new' : `/admin/flyers/${row.id}`;
  const cur = row && row.file ? flyerUrl(row.file) : '';
  const curBlock = cur
    ? `<div class="current-file"><p class="muted small">Current file: <a href="${h(cur)}" target="_blank" rel="noopener">${h(row.original_name || 'open')}</a> (${h(kb(row.size))}). Choose a new file below only if you want to replace it.</p>${row.kind === 'image' ? `<img src="${h(cur)}" alt="${h(row.alt)}" width="240" loading="lazy">` : ''}</div>`
    : '';
  const fileErr = errors.file;
  const aside = isNew ? '' : `<aside class="side-panel" aria-label="Actions">
  <div class="panel"><h2>Status</h2><p>Currently ${ui.statusBadge(row.status)}${row.status === 'published' && expired(row) ? ` ${ui.badge('Closing date passed', 'muted')}` : ''}</p><div class="button-row">${statusButtons(row, s)}</div></div>
  <div class="panel"><h2>Delete</h2><p class="hint">This also deletes the uploaded file. It cannot be undone.</p>
    ${ui.actionForm(`/admin/flyers/${row.id}/delete`, 'Delete flyer', s, { confirm: `Delete “${row.title}” permanently? This cannot be undone.`, cls: 'btn btn-danger' })}</div>
  <p class="meta">Created ${h(ui.fmtDateTime(row.created_at))}<br>Last updated ${h(ui.fmtDateTime(row.updated_at))}</p>
</aside>`;
  const kindVal = !v.kind || ['image', 'pdf', 'doc', 'file'].includes(v.kind) ? 'file' : v.kind;
  return layout(ctx, {
    title,
    active: 'flyers',
    body: `<p class="crumbs"><a href="/admin/flyers">← Job Flyers</a></p>
${ui.pageHeader(isNew ? title : row.title, '', isNew ? '' : ui.statusBadge(row.status))}
${ui.notices(ctx.query)}
${ui.errorSummary(errors)}
<div class="edit-grid${isNew ? ' no-aside' : ''}">
  <form method="post" action="${h(action)}" enctype="multipart/form-data" class="stack edit-main" data-flyer-form>
    ${ui.csrfField(s)}
    <fieldset class="panel"><legend>What kind of flyer is it?</legend>
      ${ui.field({ name: 'kind', label: 'Flyer type', type: 'select', required: true, options: FORM_KINDS, hint: 'Upload a finished flyer (an image, a PDF or a Word document), or choose Words only and type the job details so the website lays them out.' }, kindVal, errors.kind)}
    </fieldset>
    <fieldset class="panel"><legend>Flyer details</legend>
      ${ui.field({ name: 'title', label: 'Title', required: true, maxlength: 150, placeholder: 'e.g. English Tutor – Colombo' }, v.title, errors.title)}
      ${ui.field({ name: 'summary', label: 'Short description', type: 'textarea', rows: 3, maxlength: 300, hint: 'Optional. One or two sentences shown on the flyer card.' }, v.summary, errors.summary)}
      <div data-kind-show="text">
        ${ui.field({ name: 'body', label: 'Flyer text', type: 'markdown', rows: 12, maxlength: 20000, hint: 'Required for a words-only flyer.' }, v.body, errors.body)}
      </div>
      <div data-kind-show="file">
        ${curBlock}
        <div class="field${fileErr ? ' has-error' : ''}">
          <label for="f-file">Flyer file${isNew ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>
          <p class="hint" id="f-file-hint">Image (JPG, PNG or WebP), PDF or Word document (.docx or .doc), up to ${maxMb} MB. The type is detected from the file.</p>
          <input type="file" id="f-file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,.docx,.doc,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-describedby="f-file-hint${fileErr ? ' f-file-err' : ''}" data-filename${fileErr ? ' aria-invalid="true"' : ''}>
          ${fileErr ? `<p class="field-error" id="f-file-err">${h(fileErr)}</p>` : ''}
        </div>
        ${ui.field({ name: 'alt', label: 'Image description (alt text)', maxlength: 250, hint: 'Required when the file is an image: write what the flyer says so people using screen readers can read it. Ignored for PDF and Word files.' }, v.alt, errors.alt)}
      </div>
    </fieldset>
    <fieldset class="panel"><legend>Publishing</legend>
      ${ui.field({ name: 'deadline', label: 'Closing date', type: 'date', hint: 'Optional. The flyer is hidden automatically after this date. Leave blank to keep it up until you unpublish it.' }, v.deadline, errors.deadline)}
      ${ui.field({ name: 'status', label: 'Status', type: 'select', options: [['draft', 'Draft (not shown on the website)'], ['published', 'Published (shown on the Careers page)']] }, v.status, errors.status)}
      ${ui.field({ name: 'sort', label: 'Sort order', type: 'number', min: -9999, max: 9999, hint: 'Lower numbers appear first. Flyers with the same number show the newest first.' }, v.sort, errors.sort)}
    </fieldset>
    <div class="actions sticky-actions"><button type="submit" class="btn btn-primary">${isNew ? 'Add flyer' : 'Save changes'}</button> <a class="btn" href="/admin/flyers">Cancel</a></div>
  </form>
  ${aside}
</div>`,
  });
}

module.exports = { listPage, formPage, KINDS, FORM_KINDS };
