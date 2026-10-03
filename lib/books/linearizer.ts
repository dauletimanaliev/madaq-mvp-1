import { execFile } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import util from "util";

const execFileAsync = util.promisify(execFile);

export interface LinearizeResult {
  buffer: Buffer;
  isLinearized: boolean;
  error?: string;
}

/**
 * Linearizes a PDF using `qpdf --linearize` (Fast Web View, ТЗ §1, §2).
 * Reorganizes PDF objects, hint streams, and page 1 dictionaries
 * to the start of the file so clients can stream pages on-demand
 * via HTTP 206 Partial Content range requests.
 */
export async function linearizePdf(inputBuffer: Buffer): Promise<LinearizeResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "madaq-linearize-"));
  const inputPath = path.join(tmpDir, "input.pdf");
  const outputPath = path.join(tmpDir, "output.pdf");

  try {
    await fs.writeFile(inputPath, inputBuffer);

    // Execute qpdf --linearize
    await execFileAsync("qpdf", ["--linearize", inputPath, outputPath], {
      timeout: 60000, // up to 60s for huge books
    });

    const outputBuffer = await fs.readFile(outputPath);
    console.log(
      `⚡ [Линеаризация] PDF успешно линеаризован (исходный: ${inputBuffer.length} B, оптимизированный: ${outputBuffer.length} B)`
    );

    return {
      buffer: outputBuffer,
      isLinearized: true,
    };
  } catch (err: any) {
    // qpdf exit code 3 means warnings occurred, but valid output may have been created
    try {
      const outputBuffer = await fs.readFile(outputPath);
      if (outputBuffer.length > 0) {
        console.log(`⚡ [Линеаризация] Завершено с предупреждениями (выходной размер: ${outputBuffer.length} B)`);
        return { buffer: outputBuffer, isLinearized: true };
      }
    } catch {}

    console.warn("qpdf linearization fallback (keeping original):", err.message);
    return {
      buffer: inputBuffer,
      isLinearized: false,
      error: err.message,
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
