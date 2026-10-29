"use client";

import React, { memo, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask, TextLayer } from "pdfjs-dist";
import type { Highlight, HighlightType, PdfHighlightRect } from "@/lib/types";

type PdfJs = typeof import("pdfjs-dist");

const highlightBgStyles: Record<HighlightType, string> = {
  protein: "bg-red-400/40 border-b border-red-500/50",
  carbohydrate: "bg-orange-400/40 border-b border-orange-500/50",
  fat: "bg-amber-300/45 border-b border-amber-500/50",
  vitamin: "bg-emerald-400/40 border-b border-emerald-500/50",
  fiber: "bg-sky-400/40 border-b border-sky-500/50",
};
const defaultHighlightBg = "bg-amber-300/45 border-b border-amber-500/50";

interface PdfPageProps {
  pdfDoc: PDFDocumentProxy;
  pdfjs: PdfJs;
  pageNumber: number;
  /** CSS width of the page in px. */
  width: number;
  /** Height / width, used for the placeholder until the page's own size is known. */
  aspectRatio: number;
  /** Render canvas and text layer (page is near the viewport). */
  isActive: boolean;
  highlights: Highlight[];
  onAspectRatio: (pageNumber: number, ratio: number) => void;
}

/**
 * One PDF page: a sized placeholder that draws the canvas and the selectable
 * text layer only while `isActive`, so long books stay light on memory.
 */
function PdfPageImpl({
  pdfDoc,
  pdfjs,
  pageNumber,
  width,
  aspectRatio,
  isActive,
  highlights,
  onAspectRatio,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [renderedKey, setRenderedKey] = useState<string | null>(null);
  const [cssScale, setCssScale] = useState(1);

  const height = Math.round(width * aspectRatio);
  const renderKey = `${pageNumber}:${Math.round(width)}`;
  const isRendered = isActive && renderedKey === renderKey;

  useEffect(() => {
    const canvas = canvasRef.current;
    const textLayerEl = textLayerRef.current;
    if (!isActive || !canvas || !textLayerEl || width <= 0) return;

    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let textLayer: TextLayer | null = null;

    // Wait a moment so fast scrolling past a page does not trigger a render.
    const timer = setTimeout(async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const base = page.getViewport({ scale: 1 });
        const ratio = base.height / base.width;
        onAspectRatio(pageNumber, ratio);

        const scale = width / base.width;
        const viewport = page.getViewport({ scale });
        // Cap pixel density to keep canvases from exhausting memory on zoom.
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        const context = canvas.getContext("2d");
        if (!context) return;

        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform:
            outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
        });
        await renderTask.promise;
        if (cancelled) return;

        textLayerEl.replaceChildren();
        const textContent = await page.getTextContent();
        if (cancelled) return;
        if (textContent.items.length > 0) {
          textLayer = new pdfjs.TextLayer({
            textContentSource: textContent,
            container: textLayerEl,
            viewport,
          });
          await textLayer.render();
        }
        if (cancelled) return;

        setCssScale(scale);
        setRenderedKey(`${pageNumber}:${Math.round(width)}`);
      } catch (err: unknown) {
        if ((err as Error | null)?.name !== "RenderingCancelledException") {
          console.warn(`PDF page ${pageNumber} render error:`, err);
        }
      }
    }, 60);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [isActive, pdfDoc, pdfjs, pageNumber, width, onAspectRatio]);

  // Free canvas memory once the page scrolls far away.
  useEffect(() => {
    if (isActive) return;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    textLayerRef.current?.replaceChildren();
  }, [isActive]);

  return (
    <div
      data-pdf-page={pageNumber}
      className="relative mx-auto bg-white shadow-md ring-1 ring-black/5 select-text"
      style={{ width, height }}
    >
      {!isRendered && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-300 select-none">
          {pageNumber}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block select-none"
        style={{ width, height, visibility: isRendered ? "visible" : "hidden" }}
      />
      <div
        ref={textLayerRef}
        className="textLayer absolute inset-0 select-text"
        style={{ width, height, "--scale-factor": cssScale } as React.CSSProperties}
      />
      {highlights.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {highlights.map((h) =>
            ((h.rects as PdfHighlightRect[]) || []).map((r, idx) => (
              <div
                key={`${h.id}-${idx}`}
                className={`absolute rounded-xs mix-blend-multiply ${
                  (h.type && highlightBgStyles[h.type]) || defaultHighlightBg
                }`}
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.width * 100}%`,
                  height: `${r.height * 100}%`,
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export const PdfPage = memo(PdfPageImpl);
