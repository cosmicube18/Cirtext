import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import type { CircuitNode } from '../types/flow.ts';

export interface ExportOptions {
  title?: string;
  isLightMode?: boolean;
  padding?: number;
}

/**
 * Prepares the target element and bounding parameters to capture the full circuit,
 * even when zoomed out or panned off-screen.
 */
function prepareExportConfig(nodes: CircuitNode[], options?: ExportOptions) {
  if (nodes.length === 0) {
    throw new Error('Cannot export an empty circuit. Add components to the canvas first.');
  }

  const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewportEl) {
    throw new Error('Could not find React Flow viewport element on the canvas.');
  }

  const padding = options?.padding ?? 48;
  const nodesBounds = getNodesBounds(nodes);

  const imageWidth = Math.max(Math.ceil(nodesBounds.width + padding * 2), 480);
  const imageHeight = Math.max(Math.ceil(nodesBounds.height + padding * 2), 320);

  const viewport = getViewportForBounds(
    nodesBounds,
    imageWidth,
    imageHeight,
    0.2,
    2.5,
    padding
  );

  const backgroundColor = options?.isLightMode ? '#ffffff' : '#0b1120';

  const htmlToImageOptions = {
    backgroundColor,
    width: imageWidth,
    height: imageHeight,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: (node: HTMLElement) => {
      if (!node.classList) return true;
      return !(
        node.classList.contains('react-flow__controls') ||
        node.classList.contains('react-flow__minimap') ||
        node.classList.contains('react-flow__panel') ||
        node.classList.contains('react-flow__attribution')
      );
    },
  };

  return { viewportEl, htmlToImageOptions };
}

/**
 * Captures full resolution PNG data URL.
 */
export async function exportToPng(
  nodes: CircuitNode[],
  options?: ExportOptions
): Promise<string> {
  const { viewportEl, htmlToImageOptions } = prepareExportConfig(nodes, options);
  return await toPng(viewportEl, htmlToImageOptions);
}

/**
 * Captures full resolution vector SVG data URL.
 */
export async function exportToSvg(
  nodes: CircuitNode[],
  options?: ExportOptions
): Promise<string> {
  const { viewportEl, htmlToImageOptions } = prepareExportConfig(nodes, options);
  return await toSvg(viewportEl, htmlToImageOptions);
}

/**
 * Triggers a direct file download for PNG or SVG.
 */
export async function downloadDiagram(
  nodes: CircuitNode[],
  format: 'png' | 'svg',
  options?: ExportOptions
): Promise<void> {
  const rawTitle = options?.title || 'circuit-diagram';
  const cleanTitle = rawTitle.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const filename = `${cleanTitle}.${format}`;

  const dataUrl =
    format === 'png'
      ? await exportToPng(nodes, options)
      : await exportToSvg(nodes, options);

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates a clean printable document and triggers window.print().
 */
export async function printDiagram(
  nodes: CircuitNode[],
  options?: ExportOptions
): Promise<void> {
  const title = options?.title || 'Circuit Schematic';
  // Use light mode by default for printing to preserve printer ink unless specified
  const isLightMode = options?.isLightMode ?? true;

  const dataUrl = await exportToPng(nodes, { ...options, isLightMode });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to open the print dialog.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title} - Print</title>
        <style>
          @page {
            size: landscape;
            margin: 1.2cm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
            background: #ffffff;
            color: #0f172a;
            text-align: center;
          }
          header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 16px;
            border-bottom: 2px solid #cbd5e1;
            padding-bottom: 8px;
            text-align: left;
          }
          h1 {
            font-size: 18px;
            font-weight: 700;
            margin: 0 0 2px 0;
            color: #0f172a;
          }
          p {
            font-size: 11px;
            color: #64748b;
            margin: 0;
          }
          .img-container {
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 12px 0;
          }
          img {
            max-width: 100%;
            max-height: 80vh;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          footer {
            margin-top: 12px;
            font-size: 10px;
            color: #94a3b8;
            text-align: right;
          }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>${title}</h1>
            <p>Cirtext Schematic Editor • Client-Side Export</p>
          </div>
          <div>
            <p>${new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
          </div>
        </header>
        <div class="img-container">
          <img src="${dataUrl}" alt="${title}" />
        </div>
        <footer>
          <span>Generated with Cirtext CAD</span>
        </footer>
        <script>
          window.onload = function() {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
