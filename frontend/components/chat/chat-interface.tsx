"use client"

import { useEffect, useMemo, useState } from "react"
import { ChatInput } from "@/components/chat/chat-input"
import { ChatMessages } from "@/components/chat/chat-messages"
import { Topbar } from "@/components/layout/topbar"
import { SettingsDialog } from "@/components/settings/settings-dialog"
import { NotebookViewer } from "@/components/notebook/notebook-viewer"
import { ChatMatrix } from "@/components/foody/chat-matrix"
import { ScrambleText } from "@/components/foody/scramble-text"
import logo from "@/assets/logo.png"
import { fetchMetadata, streamChat } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { AttachmentPreview, ChatMessage, FoodyMetadata, LlmProviderConfig, StoredConversation, ThemeId } from "@/lib/types"

const STORAGE_KEYS = {
  conversations: "foody-conversations-v3",
  activeConversation: "foody-active-conversation-v1",
  providers: "foody-llm-providers-v1",
  selectedProvider: "foody-selected-provider-v1",
  selectedLlm: "foody-selected-llm-v1",
  selectedVision: "foody-selected-vision-v1",
  theme: "foody-theme-v1"
}

const THEME_ACCENTS: Record<string, { primary: string; dark: boolean }> = {
  dark: { primary: "0 0% 98%", dark: true },
  light: { primary: "240 5.9% 10%", dark: false },
  "really-dark": { primary: "210 40% 98%", dark: true },
  blue: { primary: "217 91% 60%", dark: true },
  "blue-light": { primary: "221 83% 53%", dark: false },
  green: { primary: "142 71% 45%", dark: true },
  "green-light": { primary: "142 76% 36%", dark: false },
  purple: { primary: "271 91% 65%", dark: true },
  "purple-light": { primary: "262 83% 58%", dark: false },
  pink: { primary: "330 81% 60%", dark: true },
  "pink-light": { primary: "336 84% 50%", dark: false },
  red: { primary: "0 84% 60%", dark: true },
  "red-light": { primary: "0 72% 51%", dark: false },
  orange: { primary: "24 95% 53%", dark: true },
  "orange-light": { primary: "20 91% 48%", dark: false },
  forest: { primary: "142 71% 45%", dark: true },
  "forest-light": { primary: "142 76% 30%", dark: false },
  ocean: { primary: "188 86% 53%", dark: true },
  "ocean-light": { primary: "188 95% 37%", dark: false },
  sunset: { primary: "20 91% 48%", dark: false },
  "sunset-light": { primary: "24 95% 53%", dark: false },
  blueberry: { primary: "239 84% 67%", dark: false },
  matcha: { primary: "84 81% 33%", dark: false },
  "peach-blossom": { primary: "350 95% 71%", dark: false },
  "lavender-mist": { primary: "258 90% 66%", dark: false },
  "cotton-candy": { primary: "330 81% 70%", dark: false },
  "mint-cream": { primary: "160 84% 39%", dark: false },
  amber: { primary: "38 92% 50%", dark: false },
  "rose-gold": { primary: "346 77% 50%", dark: false },
  seafoam: { primary: "174 72% 40%", dark: false },
  honey: { primary: "45 93% 47%", dark: false },
  sakura: { primary: "349 89% 60%", dark: false },
  cloud: { primary: "215 16% 47%", dark: false },
  berry: { primary: "292 84% 61%", dark: true },
  mocha: { primary: "32 95% 33%", dark: true },
  twilight: { primary: "239 84% 74%", dark: true },
  coral: { primary: "24 95% 53%", dark: false },
  "red-kawaii": { primary: "0 84% 60%", dark: false },
  "strawberry-milk": { primary: "350 95% 71%", dark: false },
  taro: { primary: "255 92% 76%", dark: false },
  "mint-choco": { primary: "173 80% 50%", dark: true },
  "banana-milk": { primary: "45 93% 47%", dark: false },
  pistachio: { primary: "84 81% 35%", dark: false },
  "earl-grey": { primary: "215 16% 47%", dark: false },
  bubblegum: { primary: "330 81% 60%", dark: false },
  lemonade: { primary: "40 96% 40%", dark: false },
  cantaloupe: { primary: "27 96% 61%", dark: false },
  "lilac-dream": { primary: "270 95% 75%", dark: false },
  sky: { primary: "199 89% 48%", dark: false },
  periwinkle: { primary: "239 84% 74%", dark: false },
  sherbet: { primary: "350 95% 71%", dark: false },
  "iced-coffee": { primary: "30 82% 31%", dark: false },
  aloe: { primary: "160 84% 39%", dark: false },
  graphite: { primary: "240 5% 65%", dark: true },
  "neon-nights": { primary: "188 95% 53%", dark: true },
  velvet: { primary: "292 91% 73%", dark: true },
  starlight: { primary: "213 94% 78%", dark: true },
  notebook: { primary: "215 25% 27%", dark: false },
  cyberpunk: { primary: "48 96% 53%", dark: true },
  "cyberpunk-light": { primary: "40 96% 40%", dark: false },
  halloween: { primary: "24 95% 53%", dark: true },
  jhayne: { primary: "330 81% 70%", dark: true },
  thundersnow: { primary: "199 95% 74%", dark: true },
  mario: { primary: "0 72% 51%", dark: false }
}

const GREETING_LINES = ["Ask Foody anything...", "Drop in a food image...", "Plan recipes and swaps...", "Estimate nutrition with context..."]

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function safeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .map((message) => ({
      ...message,
      isStreaming: false,
      attachment: message.attachment
        ? {
            name: message.attachment.name,
            url: message.attachment.url,
            type: message.attachment.type
          }
        : undefined
    }))
}

function titleFor(messages: ChatMessage[]) {
  const firstUser = messages.find((message) => message.role === "user")
  const prediction = messages.find((message) => message.prediction)?.prediction?.dish_name
  const base = firstUser?.content || prediction || firstUser?.attachment?.name || "New food chat"
  return base.replace(/\s+/g, " ").trim().slice(0, 48) || "New food chat"
}

function ChatGreeting() {
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLineIndex((current) => (current + 1) % GREETING_LINES.length)
    }, 4500)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center px-4 pb-5">
      <div
        className="mb-5 h-24 w-24 bg-primary opacity-95 drop-shadow-[0_18px_45px_hsl(var(--primary)/0.18)] md:h-28 md:w-28"
        style={{
          WebkitMaskImage: `url(${logo.src})`,
          maskImage: `url(${logo.src})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain"
        }}
        aria-hidden="true"
      />
      <div className="flex items-center gap-3 text-3xl font-bold tracking-tight text-primary md:text-4xl">
        <ChatMatrix dotSize={2.5} gap={2} />
        <ScrambleText text={GREETING_LINES[lineIndex]} showShimmer={false} />
      </div>
    </div>
  )
}

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<StoredConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState(makeId("chat"))
  const [isGenerating, setIsGenerating] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [metadata, setMetadata] = useState<FoodyMetadata | null>(null)
  const [metadataError, setMetadataError] = useState("")
  const [generationError, setGenerationError] = useState("")
  const [theme, setTheme] = useState<ThemeId>("dark")
  const [providers, setProviders] = useState<LlmProviderConfig[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [selectedLlmModel, setSelectedLlmModel] = useState("gpt-4o-mini")
  const [selectedVisionModel, setSelectedVisionModel] = useState("auto")
  const [storageReady, setStorageReady] = useState(false)
  const [isAppReady, setIsAppReady] = useState(false)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [notebookOpen, setNotebookOpen] = useState(false)

  useEffect(() => {
    if (storageReady && (metadata !== null || metadataError !== "")) {
      setIsFadingOut(true)
      const timer = setTimeout(() => {
        setIsAppReady(true)
      }, 700)
      return () => clearTimeout(timer)
    }
  }, [storageReady, metadata, metadataError])

  useEffect(() => {
    const savedConversations = loadJson<StoredConversation[]>(STORAGE_KEYS.conversations, [])
    const savedActiveConversationId = loadJson<string | null>(STORAGE_KEYS.activeConversation, null)
    const activeConversation = savedConversations.find((conversation) => conversation.id === savedActiveConversationId) || savedConversations[0]
    setConversations(savedConversations)
    if (activeConversation) {
      setActiveConversationId(activeConversation.id)
      setMessages(safeMessages(activeConversation.messages || []))
    }
    setProviders(loadJson<LlmProviderConfig[]>(STORAGE_KEYS.providers, []))
    setSelectedProviderId(loadJson<string | null>(STORAGE_KEYS.selectedProvider, null))
    setSelectedLlmModel(loadJson<string>(STORAGE_KEYS.selectedLlm, "gpt-4o-mini"))
    setSelectedVisionModel(loadJson<string>(STORAGE_KEYS.selectedVision, "auto"))
    setTheme(loadJson<ThemeId>(STORAGE_KEYS.theme, "dark"))
    setStorageReady(true)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("dark", "theme-matcha", "theme-blueberry", "theme-sunset")
    const palette = THEME_ACCENTS[theme] || THEME_ACCENTS.dark
    if (palette.dark) root.classList.add("dark")
    if (theme === "matcha") root.classList.add("theme-matcha")
    if (theme === "blueberry") root.classList.add("theme-blueberry")
    if (theme === "sunset") root.classList.add("theme-sunset")
    root.style.setProperty("--primary", palette.primary)
    root.style.setProperty("--ring", palette.primary)
    if (!storageReady) return
    window.localStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(theme))
  }, [theme, storageReady])

  useEffect(() => {
    fetchMetadata()
      .then((payload) => {
        setMetadata(payload)
        setMetadataError("")
        setSelectedLlmModel((current) => current || payload.llm.default_model || "gpt-4o-mini")
      })
      .catch((error) => setMetadataError(error instanceof Error ? error.message : "Could not load Foody metadata"))
  }, [])

  useEffect(() => {
    if (!storageReady) return
    window.localStorage.setItem(STORAGE_KEYS.providers, JSON.stringify(providers))
  }, [providers, storageReady])

  useEffect(() => {
    if (!storageReady) return
    window.localStorage.setItem(STORAGE_KEYS.selectedProvider, JSON.stringify(selectedProviderId))
  }, [selectedProviderId, storageReady])

  useEffect(() => {
    if (!storageReady) return
    window.localStorage.setItem(STORAGE_KEYS.selectedLlm, JSON.stringify(selectedLlmModel))
  }, [selectedLlmModel, storageReady])

  useEffect(() => {
    if (!storageReady) return
    window.localStorage.setItem(STORAGE_KEYS.selectedVision, JSON.stringify(selectedVisionModel))
  }, [selectedVisionModel, storageReady])

  useEffect(() => {
    if (!storageReady) return
    window.localStorage.setItem(STORAGE_KEYS.activeConversation, JSON.stringify(activeConversationId))
  }, [activeConversationId, storageReady])

  useEffect(() => {
    if (!storageReady || selectedProviderId || !providers[0]) return
    setSelectedProviderId(providers[0].id)
  }, [providers, selectedProviderId, storageReady])

  useEffect(() => {
    if (!storageReady) return
    if (messages.length === 0) {
      setConversations((current) => {
        const next = current.filter((conversation) => conversation.id !== activeConversationId)
        window.localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(next))
        return next
      })
      return
    }
    setConversations((current) => {
      const nextConversation: StoredConversation = {
        id: activeConversationId,
        title: titleFor(messages),
        timestamp: Date.now(),
        messages: safeMessages(messages)
      }
      const next = [nextConversation, ...current.filter((conversation) => conversation.id !== activeConversationId)].slice(0, 40)
      window.localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(next))
      return next
    })
  }, [messages, activeConversationId, storageReady])

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) || providers.find((provider) => provider.models.includes(selectedLlmModel)) || providers[0] || null

  const handleLlmModelChange = (model: string) => {
    const providerForModel = providers.find((provider) => provider.models.includes(model))
    if (providerForModel) setSelectedProviderId(providerForModel.id)
    setSelectedLlmModel(model)
  }

  const llmModels = useMemo(() => {
    const values = [metadata?.llm.default_model, ...(metadata?.llm.models || []), ...providers.flatMap((provider) => provider.models), selectedLlmModel].filter(Boolean) as string[]
    return Array.from(new Set(values.length ? values : ["gpt-4o-mini"]))
  }, [metadata, providers, selectedLlmModel])

  const llmOptions = llmModels.map((model) => ({
    id: model,
    name: model,
    description: selectedProvider?.models.includes(model) ? selectedProvider.name : "OpenAI-compatible generation model"
  }))

  const visionOptions = metadata?.vision_models?.length
    ? metadata.vision_models
    : [
        { id: "none", name: "None", description: "Disable image inference" },
        { id: "auto", name: "Best available", description: "Uses the active Food-101 checkpoint" },
        { id: "efficientnetb3", name: "EfficientNetB3", description: "Foody trained Food-101 classifier" }
      ]

  const requestAssistant = async (userMessage: ChatMessage) => {
    const assistantId = makeId("assistant")
    const controller = new AbortController()
    setGenerationError("")
    setAbortController(controller)
    setIsGenerating(true)
    setMessages((current) => [
      ...current,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        attachment: userMessage.attachment
          ? {
              name: userMessage.attachment.name,
              url: userMessage.attachment.url,
              type: userMessage.attachment.type
            }
          : undefined,
        createdAt: Date.now(),
        isStreaming: true
      }
    ])

    try {
      await streamChat(
        {
          message: userMessage.content,
          image: userMessage.attachment?.file || null,
          llmModel: selectedLlmModel,
          visionModel: selectedVisionModel,
          provider: selectedProvider,
          signal: controller.signal
        },
        {
          onMetadata: (payload) => {
            setMessages((current) => current.map((message) => (message.id === assistantId ? { ...message, prediction: payload.prediction, citations: payload.citations, stages: payload.stages, warnings: payload.warnings } : message)))
          },
          onToken: (text) => {
            setMessages((current) => current.map((message) => (message.id === assistantId ? { ...message, content: message.content + text } : message)))
          },
          onDone: (payload) => {
            setMessages((current) => current.map((message) => (message.id === assistantId ? { ...message, content: payload.answer, prediction: payload.prediction, citations: payload.citations, stages: payload.stages, warnings: payload.warnings, isStreaming: false } : message)))
          }
        }
      )
    } catch (error) {
      const stopped = error instanceof DOMException && error.name === "AbortError"
      if (!stopped) setGenerationError(error instanceof Error ? error.message : String(error))
      setMessages((current) =>
        current.flatMap((message) => {
          if (message.id !== assistantId) return [message]
          if (!message.content.trim() && !message.prediction) return []
          return [{ ...message, isStreaming: false }]
        })
      )
    } finally {
      setIsGenerating(false)
      setAbortController(null)
    }
  }

  const handleSend = (content: string, attachment?: AttachmentPreview | null) => {
    if (isGenerating) return
    setGenerationError("")
    const finalContent = content.trim()
    if (!finalContent && !attachment) return
    const userMessage: ChatMessage = {
      id: makeId("user"),
      role: "user",
      content: finalContent,
      attachment: attachment || undefined,
      createdAt: Date.now()
    }
    setMessages((current) => [...current, userMessage])
    void requestAssistant(userMessage)
  }

  const handleRegenerate = (assistantIndex: number) => {
    if (isGenerating) return
    const previousUser = [...messages.slice(0, assistantIndex)].reverse().find((message) => message.role === "user")
    if (!previousUser) return
    setMessages((current) => current.slice(0, assistantIndex))
    void requestAssistant(previousUser)
  }

  const handleDeleteMessage = (index: number) => {
    if (isGenerating) return
    setMessages((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleClearChat = () => {
    const conversationIdToRemove = activeConversationId
    abortController?.abort()
    setGenerationError("")
    setMessages([])
    setConversations((current) => {
      const next = current.filter((conversation) => conversation.id !== conversationIdToRemove)
      window.localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify(next))
      return next
    })
    setActiveConversationId(makeId("chat"))
  }

  const renderEmptyState = () => (
    <div className="flex w-full max-w-6xl flex-1 flex-col items-center text-center justify-center">
      <ChatGreeting />
      <div className="w-full max-w-3xl space-y-0">
        <ChatInput onSend={handleSend} isBusy={isGenerating} hasMessages={false} activeModel={selectedLlmModel} visionModel={selectedVisionModel} onStopGeneration={() => abortController?.abort()} />
      </div>
    </div>
  )

  const renderConversation = () => {
    if (messages.length === 0 && !isGenerating) return renderEmptyState()
    return (
      <div className="flex w-full flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <ChatMessages messages={messages} isGenerating={isGenerating} activeModel={selectedLlmModel} onRegenerate={handleRegenerate} onDelete={handleDeleteMessage} />
        </div>
        <div className="relative flex-shrink-0 pt-4 pb-0">
          <div className="mx-auto w-full max-w-3xl relative z-0 bg-none">
            <ChatInput onSend={handleSend} isBusy={isGenerating} hasMessages activeModel={selectedLlmModel} visionModel={selectedVisionModel} onStopGeneration={() => abortController?.abort()} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {!isAppReady && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-700 ease-in-out",
            isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <div className="relative flex flex-col items-center">
            {/* Glowing aura effect */}
            <div className="absolute -inset-10 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "3s" }} />
            
            {/* Rotating gradient ring */}
            <div className="relative h-28 w-28 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-muted border-t-primary animate-spin" style={{ animationDuration: "1.2s" }} />
              {/* Logo inside */}
              <div
                className="h-16 w-16 bg-foreground opacity-90"
                style={{
                  WebkitMaskImage: `url(${logo.src})`,
                  maskImage: `url(${logo.src})`,
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                  WebkitMaskSize: "contain",
                  maskSize: "contain"
                }}
              />
            </div>

            {/* Loading text */}
            <h2 className="mt-8 text-lg font-semibold tracking-wide text-foreground animate-pulse">
              Readying your recipe assistant...
            </h2>
            <p className="mt-2 text-xs text-muted-foreground font-mono">
              Connecting to Foody backend
            </p>
          </div>
        </div>
      )}

      <div suppressHydrationWarning className={cn("flex h-screen bg-background relative overflow-hidden transition-opacity duration-500 ease-out", isAppReady ? "opacity-100" : "opacity-0")}>
        <div className="relative z-10 flex h-full w-full">
          <div className="flex flex-1 flex-col z-10 w-full min-w-0">
            <div className="flex flex-1 overflow-hidden">
              <main className="flex flex-col overflow-hidden transition-all duration-300 relative flex-1 items-center pb-2 modern-chat-container">
                <Topbar
                  onSettingsClick={() => setSettingsOpen(true)}
                  onClearChat={handleClearChat}
                  onNotebookClick={() => setNotebookOpen(true)}
                  llmModel={selectedLlmModel}
                  visionModel={selectedVisionModel}
                  llmOptions={llmOptions}
                  visionOptions={visionOptions}
                  supportedFoods={metadata?.supported_foods}
                  onLlmModelChange={handleLlmModelChange}
                  onVisionModelChange={setSelectedVisionModel}
                />
                {metadataError && (
                  <div className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                    {metadataError}
                  </div>
                )}
                {generationError && (
                  <div className="mx-4 mt-3 max-w-3xl rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {generationError}
                  </div>
                )}
                {renderConversation()}
              </main>
            </div>
          </div>
        </div>
      </div>

      <NotebookViewer open={notebookOpen} onOpenChange={setNotebookOpen} />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        theme={theme}
        onThemeChange={setTheme}
        llmModels={llmModels}
        selectedLlmModel={selectedLlmModel}
        onSelectedLlmModelChange={handleLlmModelChange}
        providers={providers}
        selectedProviderId={selectedProviderId}
        onProvidersChange={setProviders}
        onSelectedProviderIdChange={setSelectedProviderId}
        visionModels={visionOptions}
        selectedVisionModel={selectedVisionModel}
        onSelectedVisionModelChange={setSelectedVisionModel}
        metadata={metadata}
      />
    </>
  )
}
