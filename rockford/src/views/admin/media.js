'use strict';
/* Media Library: upload images, copy their URLs, edit alt text, delete. */
const { h } = require('../../security');
const { layout } = require('./layout');
const ui = require('./ui');

function mediaPage(ctx, { items, maxMb, errors = {}, values = {}, itemErrors = {} }) {
  const s = ctx.session;
  const grid = items.length ? `<ul class="media-grid">${items.map((m) => {
    const url = `/uploads/${m.file}`;
    const err = itemErrors[m.id];
    return `<li class="media-item">
  <img src="${h(url)}" alt="${h(m.alt)}" loading="lazy" width="320" height="200">
  <div class="media-body">
    <p class="media-name" title="${h(m.original_name)}">${h(m.original_name)}</p>
    <p class="muted small">${Math.max(1, Math.round(m.size / 1024))} KB · ${h(ui.fmtDate(m.created_at))}</p>
    <div class="field"><label for="url-${m.id}">Image URL</label><div class="copy-row"><input type="text" id="url-${m.id}" readonly value="${h(url)}" class="mono" data-select-on-focus><button type="button" class="btn btn-small" data-copy="url-${m.id}">Copy</button></div></div>
    <form method="post" action="/admin/media/${m.id}" class="stack">
      ${ui.csrfField(s)}
      <div class="field${err ? ' has-error' : ''}"><label for="alt-${m.id}">Alt text</label><input type="text" id="alt-${m.id}" name="alt" value="${h(err ? err.value : m.alt)}" maxlength="250"${err ? ` aria-invalid="true" aria-describedby="alt-${m.id}-err"` : ''}>${err ? `<p class="field-error" id="alt-${m.id}-err">${h(err.message)}</p>` : ''}</div>
      <button type="submit" class="btn btn-small">Save alt text</button>
    </form>
    ${ui.actionForm(`/admin/media/${m.id}/delete`, 'Delete', s, { confirm: 'Delete this image? Pages that use its URL will show a broken image.', cls: 'btn btn-small btn-danger' })}
  </div>
</li>`;
  }).join('')}</ul>` : '<p class="empty">No images uploaded yet.</p>';
  return layout(ctx, {
    title: 'Media Library',
    active: 'media',
    body: `${ui.pageHeader('Media Library', '', 'Upload photos, then paste their URL into a programme, article, testimonial or the Images section of Website Pages.')}
${ui.notices(ctx.query)}
${ui.errorSummary(errors)}
<form method="post" action="/admin/media" enctype="multipart/form-data" class="panel stack upload-form">
  ${ui.csrfField(s)}
  <h2>Upload an image</h2>
  <div class="field${errors.file ? ' has-error' : ''}">
    <label for="f-file">Image file</label>
    <p class="hint" id="f-file-hint">JPG, PNG or WebP, up to ${maxMb} MB. Use photos you have permission to publish.</p>
    <input type="file" id="f-file" name="file" accept="image/jpeg,image/png,image/webp" required aria-describedby="f-file-hint${errors.file ? ' f-file-err' : ''}" data-filename>
    ${errors.file ? `<p class="field-error" id="f-file-err">${h(errors.file)}</p>` : ''}
  </div>
  ${ui.field({ name: 'alt', label: 'Alt text', required: true, maxlength: 250, hint: 'Describe what the photo shows for people using screen readers, e.g. “Students presenting to a small group”.' }, values.alt, errors.alt)}
  <button type="submit" class="btn btn-primary">Upload</button>
</form>
<h2 class="section-title">Uploaded images</h2>
${grid}`,
  });
}

module.exports = { mediaPage };
