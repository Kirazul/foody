export type ThemeId = string

export type ChatRole = "user" | "assistant"

export interface Citation {
  id: string
  title: string
  source: string
  score: number
  text: string
}

export interface Prediction {
  dish_name?: string
  class_name?: string
  model?: string
  status?: string
  confidence?: number
  confidence_label?: "high" | "medium" | "low"
  task?: "food101_classification" | string
  top_predictions?: Array<{
    dish_name: string
    class_name: string
    confidence: number
  }>
  warning?: string | null
}

export interface ChatResponse {
  answer: string
  prediction?: Prediction | null
  citations: Citation[]
  stages: string[]
  warnings: string[]
}

export interface AttachmentPreview {
  name: string
  url: string
  type?: string
  file?: File
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  attachment?: AttachmentPreview
  prediction?: Prediction | null
  citations?: Citation[]
  stages?: string[]
  warnings?: string[]
  isStreaming?: boolean
}

export interface ConversationSummary {
  id: string
  title: string
  timestamp: number
}

export interface LlmProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: string[]
}

export interface FoodyMetadata {
  models: Record<string, boolean>
  vision_models: Array<{ id: string; name: string; description?: string }>
  supported_foods?: Array<{ id: string; name: string }>
  llm: {
    base_url: string
    default_model: string
    models: string[]
    api_key_configured: boolean
    sends_image_to_llm: boolean
  }
  rag_chunks: number
  pipeline: string[]
}

export interface StoredConversation {
  id: string
  title: string
  timestamp: number
  messages: ChatMessage[]
}
