/**
 * Export utilities for handwritten notes and diagrams:
 * - High-resolution PNG download
 * - Direct image copy to clipboard
 * - PDF print generation with pure CSS pagination
 */

export function sanitizeExportFileName(title: string, ext = 'png'): string {
  const clean = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `${clean || 'documento'}.${ext}`;
}

export function buildPrintHtml(title: string, imageDataUrl: string, textContent?: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - Nota Scribe</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      color: #0f172a;
    }
    .date {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .canvas-container {
      width: 100%;
      text-align: center;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .canvas-img {
      max-width: 100%;
      height: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .text-content {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      white-space: pre-wrap;
      border-top: 1px dashed #cbd5e1;
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">${escapeHtml(title)}</h1>
    <div class="date">Exportado desde Nota Scribe &bull; ${new Date().toLocaleDateString('es')}</div>
  </div>
  <div class="canvas-container">
    <img src="${imageDataUrl}" class="canvas-img" alt="${escapeHtml(title)}" />
  </div>
  ${textContent ? `<div class="text-content"><h3>Transcripción / Texto:</h3><p>${escapeHtml(textContent)}</p></div>` : ''}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          resolve(false);
          return;
        }
        try {
          if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([
              new window.ClipboardItem({ 'image/png': blob }),
            ]);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch {
          resolve(false);
        }
      }, 'image/png');
    });
  } catch {
    return false;
  }
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function triggerPrintPdf(title: string, canvas: HTMLCanvasElement, textContent?: string): void {
  const dataUrl = canvas.toDataURL('image/png');
  const htmlContent = buildPrintHtml(title, dataUrl, textContent);

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  } else {
    // Fallback: create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    }
  }
}
