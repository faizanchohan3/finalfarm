// Escape user-entered text before interpolating it into print-window HTML.
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function buildPrintHeader(shop: any): string {
  const name = shop?.name || "Argo-Firn"
  const ownerName = shop?.ownerName || ""
  const phones = [shop?.phone, shop?.phone2].filter(Boolean).map(escapeHtml)
  const address = escapeHtml(shop?.address || "")
  const logo = shop?.logo || ""
  const initial = (name[0] || "G").toUpperCase()

  return `
    <div style="background:linear-gradient(135deg,#7c3aed 0%,#6366f1 55%,#4f46e5 100%);color:#fff;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:14px;">
        ${logo
          ? `<img src="${logo}" style="width:58px;height:58px;border-radius:8px;background:#fff;padding:4px;object-fit:contain;box-shadow:0 2px 8px rgba(0,0,0,0.25)" />`
          : `<div style="width:58px;height:58px;border-radius:8px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;border:2px solid rgba(255,255,255,0.3)">${initial}</div>`
        }
        <div>
          <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px;line-height:1.15">${name}</div>
          ${ownerName ? `<div style="font-size:11px;opacity:0.8;margin-top:4px;font-weight:500">${ownerName}</div>` : ""}
        </div>
      </div>
      <div style="text-align:right;font-size:11px;line-height:1.9;opacity:0.9">
        ${phones.map((p) => `<div>&#9990;&nbsp; ${p}</div>`).join("")}
        ${address ? `<div>&#9679;&nbsp; ${address}</div>` : ""}
      </div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,#f0abfc 0%,#a78bfa 50%,#818cf8 100%);"></div>
  `
}

export const receiptCSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; margin: 0; padding: 0; background: #fff; color: #1f2937; max-width: 640px; margin: 0 auto; }
  .doc-header { padding: 14px 24px; background: #faf5ff; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
  .doc-title { font-size: 17px; font-weight: 800; color: #5b21b6; }
  .doc-sub { font-size: 10px; color: #6b7280; margin-top: 3px; line-height: 1.6; }
  .doc-meta { text-align: right; font-size: 10px; color: #6b7280; line-height: 1.8; }
  .body-pad { padding: 0 24px 24px; }
  .info-grid { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px 14px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; }
  .info-grid > div { font-size: 11px; min-width: 100px; }
  .lbl { color: #9ca3af; text-transform: uppercase; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; }
  .val { font-weight: 700; margin-top: 3px; color: #111827; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; border-radius: 6px; overflow: hidden; }
  thead tr { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; }
  th { padding: 8px 10px; font-size: 9px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; text-align: left; }
  td { padding: 7px 10px; font-size: 11px; border-bottom: 1px solid #f3f4f6; }
  tbody tr:nth-child(even) { background: #faf5ff; }
  tfoot tr { background: #f5f3ff; font-weight: 700; }
  tfoot td { border-top: 2px solid #6366f1; font-size: 11px; }
  .totals-box { margin-left: auto; width: 260px; }
  .totals-box table { border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
  .totals-box td { padding: 6px 12px; border-bottom: 1px solid #f0f0f0; }
  .totals-box .grand { font-weight: 800; font-size: 13px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 9px; font-weight: 700; }
  .badge-PAID { background: #dcfce7; color: #166534; }
  .badge-PARTIAL { background: #fef9c3; color: #854d0e; }
  .badge-PENDING { background: #fee2e2; color: #b91c1c; }
  .sig-row { margin-top: 36px; display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; padding-top: 10px; border-top: 1px dashed #e5e7eb; }
  .amount-big { font-size: 16px; font-weight: 900; }
  @media print { body { max-width: 100%; } @page { margin: 10mm; } }
`

export const reportCSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; margin: 0; padding: 0; background: #fff; color: #1f2937; }
  .doc-header { padding: 12px 20px; background: #faf5ff; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .doc-title { font-size: 15px; font-weight: 800; color: #5b21b6; }
  .doc-sub { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .doc-meta { text-align: right; font-size: 10px; color: #6b7280; line-height: 1.7; }
  .body-pad { padding: 0 20px 20px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; }
  th { padding: 7px 8px; font-size: 8.5px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; text-align: left; white-space: nowrap; }
  td { padding: 5px 8px; font-size: 10px; border-bottom: 1px solid #f0f0f0; }
  tbody tr:nth-child(even) { background: #faf5ff; }
  tbody tr:hover { background: #f5f3ff; }
  tfoot tr { background: #f5f3ff; font-weight: 700; }
  tfoot td { border-top: 2px solid #6366f1; font-size: 10px; padding: 6px 8px; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 99px; font-size: 8px; font-weight: 700; }
  .badge-PAID { background: #dcfce7; color: #166534; }
  .badge-PARTIAL { background: #fef9c3; color: #854d0e; }
  .badge-PENDING { background: #fee2e2; color: #b91c1c; }
  @media print { body { } @page { margin: 8mm; } }
`

// Urdu bill layout used by Bill Maker and the Potato Store prints (RTL, Nastaliq font, purple total bar).
export const billFontLink = `<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">`

export const billCSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Noto Nastaliq Urdu', 'Segoe UI', Arial, sans-serif; margin: 0 auto; max-width: 640px; color: #1f2937; font-size: 13px; }
  .num { font-family: 'Segoe UI', Arial, sans-serif; direction: ltr; unicode-bidi: embed; }
  .meta { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px 4px; }
  .meta b { font-family: 'Segoe UI', Arial, sans-serif; }
  .name { padding: 4px 24px 12px; border-bottom: 1px solid #e5e7eb; font-size: 15px; }
  .section { padding: 12px 24px 0; font-weight: 700; color: #5b21b6; font-size: 14px; }
  .section small { font-weight: 400; color: #6b7280; font-size: 12px; }
  table { width: calc(100% - 48px); margin: 14px 24px; border-collapse: collapse; }
  th { background: #f5f3ff; color: #5b21b6; padding: 8px; font-weight: 700; border-bottom: 2px solid #c4b5fd; }
  td { padding: 7px 8px; text-align: center; border-bottom: 1px solid #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif; }
  tfoot td { font-weight: 700; background: #f5f3ff; border-top: 2px solid #c4b5fd; }
  .sum { width: calc(100% - 48px); margin: 4px 24px; }
  .sum div { display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; border-bottom: 1px dashed #e5e7eb; }
  .sum span:last-child { font-family: 'Segoe UI', Arial, sans-serif; font-weight: 700; }
  .grand { background: #5b21b6; color: #fff; border-radius: 6px; margin-top: 8px; font-size: 16px; border: 0 !important; }
  .sig { display: flex; justify-content: space-between; padding: 40px 24px 20px; font-size: 12px; color: #6b7280; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`
