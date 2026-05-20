import type { ChatResponse, FoodyMetadata, LlmProviderConfig } from "@/lib/types"

export const DEFAULT_API_URL = process.env.NEXT_PUBLIC_FOODY_API_URL || "http://127.0.0.1:8000"

export function getApiUrl() {
  if (typeof window === "undefined") return DEFAULT_API_URL
  return window.localStorage.getItem("foody-api-url") || DEFAULT_API_URL
}

export function setApiUrl(value: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("foody-api-url", value.replace(/\/$/, ""))
  }
}

export async function sendChat(params: { message: string; image?: File | null; llmModel: string; visionModel: string; provider?: LlmProviderConfig | null; apiUrl?: string }): Promise<ChatResponse> {
  const form = new FormData()
  form.append("message", params.message)
  form.append("llm_model", params.llmModel)
  form.append("vision_model", params.visionModel)
  if (params.provider) {
    form.append("llm_base_url", params.provider.baseUrl)
    form.append("llm_api_key", params.provider.apiKey)
  }
  if (params.image) form.append("file", params.image)

  const response = await fetch(`${params.apiUrl || getApiUrl()}/chat`, {
    method: "POST",
    body: form
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.detail || `Foody API returned ${response.status}`)
  }

  return response.json()
}

export async function streamChat(
  params: { message: string; image?: File | null; llmModel: string; visionModel: string; provider?: LlmProviderConfig | null; apiUrl?: string; signal?: AbortSignal },
  handlers: {
    onMetadata?: (payload: Partial<ChatResponse>) => void
    onToken?: (text: string) => void
    onDone?: (payload: ChatResponse) => void
    onError?: (error: Error) => void
  }
): Promise<ChatResponse | null> {
  const form = new FormData()
  form.append("message", params.message)
  form.append("llm_model", params.llmModel)
  form.append("vision_model", params.visionModel)
  if (params.provider) {
    form.append("llm_base_url", params.provider.baseUrl)
    form.append("llm_api_key", params.provider.apiKey)
  }
  if (params.image) form.append("file", params.image)

  const response = await fetch(`${params.apiUrl || getApiUrl()}/chat/stream`, {
    method: "POST",
    body: form,
    signal: params.signal
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.detail || `Foody API returned ${response.status}`)
  }

  if (!response.body) {
    throw new Error("Streaming response was empty")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let finalPayload: ChatResponse | null = null

  const parseEvent = (raw: string) => {
    const lines = raw.split(/\r?\n/)
    const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message"
    const data = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
    if (!data) return
    const payload = JSON.parse(data)
    if (event === "metadata") handlers.onMetadata?.(payload)
    if (event === "token") handlers.onToken?.(payload.text || "")
    if (event === "done") {
      finalPayload = payload
      handlers.onDone?.(payload)
    }
    if (event === "error") {
      throw new Error(payload.detail || "Foody stream failed")
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let boundary = buffer.indexOf("\n\n")
    while (boundary >= 0) {
      const raw = buffer.slice(0, boundary).trim()
      buffer = buffer.slice(boundary + 2)
      if (raw) parseEvent(raw)
      boundary = buffer.indexOf("\n\n")
    }
  }
  if (buffer.trim()) parseEvent(buffer.trim())
  return finalPayload
}

export async function fetchMetadata(apiUrl = getApiUrl()): Promise<FoodyMetadata> {
  const response = await fetch(`${apiUrl}/metadata`, { cache: "no-store" })
  if (!response.ok) throw new Error(`Foody API returned ${response.status}`)
  return response.json()
}

export async function fetchOpenAICompatibleModels(params: { baseUrl: string; apiKey: string; apiUrl?: string }): Promise<string[]> {
  const response = await fetch(`${params.apiUrl || getApiUrl()}/llm/models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_url: params.baseUrl, api_key: params.apiKey })
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.detail || `Could not fetch models (${response.status})`)
  }

  const payload = await response.json()
  return payload.models || []
}
