import html2pdf from 'html2pdf.js';

export interface PDFExportOptions {
  filename: string;
  title?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Exports any HTML element as a PDF document using html2pdf.js,
 * preserving Arabic typography, RTL direction, exact colors, and table layout.
 */
export async function exportElementToPDF(
  element: HTMLElement,
  options: PDFExportOptions
): Promise<void> {
  const filename = options.filename.endsWith('.pdf')
    ? options.filename
    : `${options.filename}.pdf`;

  const opt = {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      logging: false,
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: options.orientation || 'portrait',
    },
  };

  try {
    await html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('html2pdf generation error, falling back to print dialog:', error);
    // Fallback: open clean print window
    printElementDirectly(element, options.title || filename);
  }
}

/**
 * Direct print fallback that opens a printable window
 */
export function printElementDirectly(element: HTMLElement, title: string = 'Report'): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const content = element.outerHTML;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            margin: 0;
            padding: 10px;
            direction: rtl;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 8px 12px;
          }
          th {
            background-color: #4a86e8 !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        ${content}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
