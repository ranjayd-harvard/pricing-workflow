import {
  TextractClient,
  AnalyzeDocumentCommand,
  Block,
  BlockType,
  FeatureType,
} from '@aws-sdk/client-textract'

function getClient() {
  return new TextractClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

// Textract inline bytes only support JPEG and PNG
const TEXTRACT_SUPPORTED = new Set(['image/jpeg', 'image/jpg', 'image/png'])

export function isTextractSupported(mimeType: string) {
  return TEXTRACT_SUPPORTED.has(mimeType)
}

function buildTableText(blocks: Block[]): Map<string, string> {
  const blockMap = new Map<string, Block>(blocks.map(b => [b.Id!, b]))
  const tableTexts = new Map<string, string>()

  const tables = blocks.filter(b => b.BlockType === BlockType.TABLE)
  for (const table of tables) {
    const cellIds = (table.Relationships || []).find(r => r.Type === 'CHILD')?.Ids ?? []
    const cells = cellIds.map(id => blockMap.get(id)).filter((b): b is Block => b?.BlockType === BlockType.CELL)

    const rowMap = new Map<number, Map<number, string>>()
    for (const cell of cells) {
      const row = cell.RowIndex ?? 0
      const col = cell.ColumnIndex ?? 0
      const wordIds = (cell.Relationships || []).find(r => r.Type === 'CHILD')?.Ids ?? []
      const text = wordIds.map(id => blockMap.get(id)?.Text ?? '').join(' ').trim()
      if (!rowMap.has(row)) rowMap.set(row, new Map())
      rowMap.get(row)!.set(col, text)
    }

    const sortedRows = Array.from(rowMap.entries()).sort((a, b) => a[0] - b[0])
    const lines = sortedRows.map(([, cols]) => {
      const sortedCols = Array.from(cols.entries()).sort((a, b) => a[0] - b[0])
      return sortedCols.map(([, text]) => text).join('\t')
    })
    tableTexts.set(table.Id!, lines.join('\n'))
  }
  return tableTexts
}

/**
 * Extracts text from an image using AWS Textract AnalyzeDocument.
 * Reconstructs tables as tab-separated rows; remaining lines are appended in reading order.
 * Only JPEG and PNG are supported for inline bytes.
 */
export async function extractTextWithTextract(buffer: Buffer, mimeType: string): Promise<string> {
  if (!isTextractSupported(mimeType)) {
    throw new Error(`AWS Textract only supports JPEG and PNG for direct upload. Please convert your image or use Google Gemini for this file type.`)
  }

  const client = getClient()
  const command = new AnalyzeDocumentCommand({
    Document: { Bytes: buffer },
    FeatureTypes: [FeatureType.TABLES, FeatureType.FORMS],
  })

  const response = await client.send(command)
  const blocks = response.Blocks ?? []
  const tableTexts = buildTableText(blocks)

  const tableBlockIds = new Set<string>()
  for (const b of blocks) {
    if (b.BlockType === BlockType.TABLE) {
      const childIds = (b.Relationships || []).find(r => r.Type === 'CHILD')?.Ids ?? []
      for (const id of childIds) tableBlockIds.add(id)
    }
  }

  const parts: Array<{ top: number; left: number; text: string }> = []

  for (const b of blocks) {
    if (b.BlockType === BlockType.TABLE) {
      const text = tableTexts.get(b.Id!)
      if (text) {
        parts.push({
          top: b.Geometry?.BoundingBox?.Top ?? 0,
          left: b.Geometry?.BoundingBox?.Left ?? 0,
          text,
        })
      }
    } else if (b.BlockType === BlockType.LINE && !tableBlockIds.has(b.Id!) && b.Text) {
      parts.push({
        top: b.Geometry?.BoundingBox?.Top ?? 0,
        left: b.Geometry?.BoundingBox?.Left ?? 0,
        text: b.Text,
      })
    }
  }

  parts.sort((a, b) => {
    if (Math.abs(a.top - b.top) < 0.02) return a.left - b.left
    return a.top - b.top
  })

  return parts.map(p => p.text).join('\n')
}
