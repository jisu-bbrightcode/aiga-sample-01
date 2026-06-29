export interface KcbPopupForm {
  url: string;
  method: string;
  fields: Record<string, string>;
}

/**
 * Open a centered popup window and auto-submit the KCB redirect form into it.
 * KCB requires a POST form submit to its popup endpoint (CommonSvl) with the
 * module token; a plain `window.open(url)` would not carry those hidden fields.
 */
export function openKcbPopup({ url, method, fields }: KcbPopupForm): Window | null {
  const popup = window.open("", "kcb-identity-popup", popupFeatures());
  if (!popup) return null;

  const doc = popup.document;
  const form = doc.createElement("form");
  form.method = (method || "POST").toUpperCase();
  form.action = url;

  for (const [name, value] of Object.entries(fields)) {
    const input = doc.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  doc.body.appendChild(form);
  form.submit();
  return popup;
}

function popupFeatures(): string {
  const width = 460;
  const height = 640;
  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
  return `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}
