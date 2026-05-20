export interface CellOutput {
  outputType: "text" | "image" | "error" | "html"
  content: string
}

export interface NotebookCell {
  index: number
  type: "markdown" | "code"
  source: string
  outputs: CellOutput[]
  executionCount: number | null
}

export interface ParsedNotebook {
  cells: NotebookCell[]
  metadata: { kernelspec?: { display_name?: string } }
}

export interface StageEntry {
  title: string
  cellIndex: number
}

function joinSource(source: string | string[]): string {
  return Array.isArray(source) ? source.join("") : source
}

function parseOutputs(rawOutputs: any[]): CellOutput[] {
  const raw: CellOutput[] = []
  for (const out of rawOutputs) {
    if (out.output_type === "stream") {
      raw.push({ outputType: "text", content: joinSource(out.text || "") })
    } else if (out.output_type === "error") {
      const traceback = (out.traceback || []).join("\n")
      raw.push({ outputType: "error", content: traceback })
    } else if (out.output_type === "execute_result" || out.output_type === "display_data") {
      const data = out.data || {}
      if (data["image/png"]) {
        raw.push({ outputType: "image", content: `data:image/png;base64,${data["image/png"]}` })
      } else if (data["text/html"]) {
        raw.push({ outputType: "html", content: joinSource(data["text/html"]) })
      } else if (data["text/plain"]) {
        raw.push({ outputType: "text", content: joinSource(data["text/plain"]) })
      }
    }
  }
  // Merge consecutive text outputs into single blocks
  const merged: CellOutput[] = []
  for (const out of raw) {
    const prev = merged[merged.length - 1]
    if (out.outputType === "text" && prev?.outputType === "text") {
      prev.content += out.content
    } else {
      merged.push({ ...out })
    }
  }
  return merged
}

export function parseNotebook(raw: any): ParsedNotebook {
  const cells: NotebookCell[] = (raw.cells || []).map((cell: any, index: number) => ({
    index,
    type: cell.cell_type === "code" ? "code" : "markdown",
    source: joinSource(cell.source || ""),
    outputs: parseOutputs(cell.outputs || []),
    executionCount: cell.execution_count ?? null,
  }))
  return {
    cells,
    metadata: raw.metadata || {},
  }
}

export function extractStages(cells: NotebookCell[]): StageEntry[] {
  const stages: StageEntry[] = []
  for (const cell of cells) {
    if (cell.type !== "markdown") continue
    const match = cell.source.match(/^#\s+(.+)/m)
    if (match) {
      stages.push({ title: match[1].trim(), cellIndex: cell.index })
    }
  }
  return stages
}
