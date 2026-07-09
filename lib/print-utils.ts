export function buildPrintHeader(shop: any): string {
  const name = shop?.name || "Argo-Firn"
  const ownerName = shop?.ownerName || ""
  const phone = shop?.phone || ""
  const address = shop?.address || ""
  const logo = shop?.logo || ""
  const initial = (name[0] || "G").toUpperCase()

  return `
    <div style="background:linear-gradient(135deg,#14532d 0%,#166534 60%,#15803d 100%);color:#fff;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;">
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
        ${phone ? `<div>&#9990;&nbsp; ${phone}</div>` : ""}
        ${address ? `<div>&#9679;&nbsp; ${address}</div>` : ""}
      </div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,#fbbf24 0%,#f59e0b 50%,#d97706 100%);"></div>
  `
}

export const receiptCSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; margin: 0; padding: 0; background: #fff; color: #1f2937; max-width: 640px; margin: 0 auto; }
  .doc-header { padding: 14px 24px; background: #f8fdf8; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
  .doc-title { font-size: 17px; font-weight: 800; color: #14532d; }
  .doc-sub { font-size: 10px; color: #6b7280; margin-top: 3px; line-height: 1.6; }
  .doc-meta { text-align: right; font-size: 10px; color: #6b7280; line-height: 1.8; }
  .body-pad { padding: 0 24px 24px; }
  .info-grid { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px 14px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb; }
  .info-grid > div { font-size: 11px; min-width: 100px; }
  .lbl { color: #9ca3af; text-transform: uppercase; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; }
  .val { font-weight: 700; margin-top: 3px; color: #111827; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; border-radius: 6px; overflow: hidden; }
  thead tr { background: linear-gradient(135deg, #14532d, #15803d); color: #fff; }
  th { padding: 8px 10px; font-size: 9px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; text-align: left; }
  td { padding: 7px 10px; font-size: 11px; border-bottom: 1px solid #f3f4f6; }
  tbody tr:nth-child(even) { background: #f9fdf9; }
  tfoot tr { background: #f0fdf4; font-weight: 700; }
  tfoot td { border-top: 2px solid #166534; font-size: 11px; }
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
  .doc-header { padding: 12px 20px; background: #f8fdf8; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .doc-title { font-size: 15px; font-weight: 800; color: #14532d; }
  .doc-sub { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .doc-meta { text-align: right; font-size: 10px; color: #6b7280; line-height: 1.7; }
  .body-pad { padding: 0 20px 20px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: linear-gradient(135deg, #14532d, #15803d); color: #fff; }
  th { padding: 7px 8px; font-size: 8.5px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; text-align: left; white-space: nowrap; }
  td { padding: 5px 8px; font-size: 10px; border-bottom: 1px solid #f0f0f0; }
  tbody tr:nth-child(even) { background: #f9fdf9; }
  tbody tr:hover { background: #f0fdf4; }
  tfoot tr { background: #f0fdf4; font-weight: 700; }
  tfoot td { border-top: 2px solid #166534; font-size: 10px; padding: 6px 8px; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 99px; font-size: 8px; font-weight: 700; }
  .badge-PAID { background: #dcfce7; color: #166534; }
  .badge-PARTIAL { background: #fef9c3; color: #854d0e; }
  .badge-PENDING { background: #fee2e2; color: #b91c1c; }
  @media print { body { } @page { margin: 8mm; } }
`

