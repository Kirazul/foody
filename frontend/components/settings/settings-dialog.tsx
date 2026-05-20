"use client"

import { X, Palette, Bot, Database, Info, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FoodyMetadata, LlmProviderConfig, ThemeId } from "@/lib/types"
import { fetchOpenAICompatibleModels, getApiUrl, setApiUrl } from "@/lib/api"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme: ThemeId
  onThemeChange: (theme: ThemeId) => void
  llmModels: string[]
  selectedLlmModel: string
  onSelectedLlmModelChange: (value: string) => void
  providers: LlmProviderConfig[]
  selectedProviderId: string | null
  onProvidersChange: (providers: LlmProviderConfig[]) => void
  onSelectedProviderIdChange: (providerId: string | null) => void
  visionModels: Array<{ id: string; name: string; description?: string }>
  selectedVisionModel: string
  onSelectedVisionModelChange: (value: string) => void
  metadata: FoodyMetadata | null
}

const themes: Array<{ id: ThemeId; name: string; type: "dark" | "light"; primaryColor: string }> = [
  { id: "dark", name: "Dark", type: "dark", primaryColor: "#fafafa" },
  { id: "light", name: "Light", type: "light", primaryColor: "#111827" },
  { id: "really-dark", name: "Really Dark", type: "dark", primaryColor: "#f8fafc" },
  { id: "blue", name: "Blue", type: "dark", primaryColor: "#3b82f6" },
  { id: "blue-light", name: "Blue Light", type: "light", primaryColor: "#2563eb" },
  { id: "green", name: "Green", type: "dark", primaryColor: "#22c55e" },
  { id: "green-light", name: "Green Light", type: "light", primaryColor: "#16a34a" },
  { id: "purple", name: "Purple", type: "dark", primaryColor: "#a855f7" },
  { id: "purple-light", name: "Purple Light", type: "light", primaryColor: "#7c3aed" },
  { id: "pink", name: "Pink", type: "dark", primaryColor: "#ec4899" },
  { id: "pink-light", name: "Pink Light", type: "light", primaryColor: "#db2777" },
  { id: "red", name: "Red", type: "dark", primaryColor: "#ef4444" },
  { id: "red-light", name: "Red Light", type: "light", primaryColor: "#dc2626" },
  { id: "orange", name: "Orange", type: "dark", primaryColor: "#f97316" },
  { id: "orange-light", name: "Orange Light", type: "light", primaryColor: "#ea580c" },
  { id: "forest", name: "Forest", type: "dark", primaryColor: "#22c55e" },
  { id: "forest-light", name: "Forest Light", type: "light", primaryColor: "#15803d" },
  { id: "ocean", name: "Ocean", type: "dark", primaryColor: "#06b6d4" },
  { id: "ocean-light", name: "Ocean Light", type: "light", primaryColor: "#0891b2" },
  { id: "sunset", name: "Sunset", type: "light", primaryColor: "#ea580c" },
  { id: "sunset-light", name: "Sunset Light", type: "light", primaryColor: "#f97316" },
  { id: "peach-blossom", name: "Peach Blossom", type: "light", primaryColor: "#fb7185" },
  { id: "matcha", name: "Matcha", type: "light", primaryColor: "#4d7c0f" },
  { id: "lavender-mist", name: "Lavender Mist", type: "light", primaryColor: "#8b5cf6" },
  { id: "cotton-candy", name: "Cotton Candy", type: "light", primaryColor: "#f472b6" },
  { id: "mint-cream", name: "Mint Cream", type: "light", primaryColor: "#10b981" },
  { id: "amber", name: "Amber", type: "light", primaryColor: "#f59e0b" },
  { id: "rose-gold", name: "Rose Gold", type: "light", primaryColor: "#e11d48" },
  { id: "seafoam", name: "Seafoam", type: "light", primaryColor: "#14b8a6" },
  { id: "honey", name: "Honey", type: "light", primaryColor: "#eab308" },
  { id: "sakura", name: "Sakura", type: "light", primaryColor: "#f43f5e" },
  { id: "cloud", name: "Cloud", type: "light", primaryColor: "#64748b" },
  { id: "berry", name: "Berry", type: "dark", primaryColor: "#d946ef" },
  { id: "mocha", name: "Mocha", type: "dark", primaryColor: "#a16207" },
  { id: "twilight", name: "Twilight", type: "dark", primaryColor: "#818cf8" },
  { id: "coral", name: "Coral", type: "light", primaryColor: "#f97316" },
  { id: "red-kawaii", name: "Red Kawaii", type: "light", primaryColor: "#ef4444" },
  { id: "strawberry-milk", name: "Strawberry Milk", type: "light", primaryColor: "#fb7185" },
  { id: "taro", name: "Taro", type: "light", primaryColor: "#a78bfa" },
  { id: "mint-choco", name: "Mint Choco", type: "dark", primaryColor: "#2dd4bf" },
  { id: "banana-milk", name: "Banana Milk", type: "light", primaryColor: "#eab308" },
  { id: "blueberry", name: "Blueberry", type: "light", primaryColor: "#6366f1" },
  { id: "pistachio", name: "Pistachio", type: "light", primaryColor: "#65a30d" },
  { id: "earl-grey", name: "Earl Grey", type: "light", primaryColor: "#64748b" },
  { id: "bubblegum", name: "Bubblegum", type: "light", primaryColor: "#ec4899" },
  { id: "lemonade", name: "Lemonade", type: "light", primaryColor: "#ca8a04" },
  { id: "cantaloupe", name: "Cantaloupe", type: "light", primaryColor: "#fb923c" },
  { id: "lilac-dream", name: "Lilac Dream", type: "light", primaryColor: "#c084fc" },
  { id: "sky", name: "Sky", type: "light", primaryColor: "#0ea5e9" },
  { id: "periwinkle", name: "Periwinkle", type: "light", primaryColor: "#818cf8" },
  { id: "sherbet", name: "Sherbet", type: "light", primaryColor: "#fb7185" },
  { id: "iced-coffee", name: "Iced Coffee", type: "light", primaryColor: "#92400e" },
  { id: "aloe", name: "Aloe", type: "light", primaryColor: "#10b981" },
  { id: "graphite", name: "Graphite", type: "dark", primaryColor: "#a1a1aa" },
  { id: "neon-nights", name: "Neon Nights", type: "dark", primaryColor: "#22d3ee" },
  { id: "velvet", name: "Velvet", type: "dark", primaryColor: "#e879f9" },
  { id: "starlight", name: "Starlight", type: "dark", primaryColor: "#93c5fd" },
  { id: "notebook", name: "Notebook", type: "light", primaryColor: "#334155" },
  { id: "marshmallow", name: "Marshmallow", type: "light", primaryColor: "#f9a8d4" },
  { id: "cyberpunk", name: "Cyberpunk", type: "dark", primaryColor: "#facc15" },
  { id: "cyberpunk-light", name: "Cyberpunk Light", type: "light", primaryColor: "#ca8a04" },
  { id: "halloween", name: "Halloween", type: "dark", primaryColor: "#f97316" },
  { id: "jhayne", name: "Jhayne", type: "dark", primaryColor: "#f472b6" },
  { id: "thundersnow", name: "Thundersnow", type: "dark", primaryColor: "#bae6fd" },
  { id: "mario", name: "Mario", type: "light", primaryColor: "#dc2626" }
]

const providerPresets = [
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { name: "AquaDevs", baseUrl: "https://api.aquadevs.com/v1", model: "gpt-4o-mini" },
  { name: "Local OpenAI", baseUrl: "http://127.0.0.1:11434/v1", model: "llama3.2" }
]

const navigationItems = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "models", label: "Models", icon: Bot },
  { id: "data", label: "RAG + Data", icon: Database },
  { id: "about", label: "About", icon: Info }
] as const

type Tab = (typeof navigationItems)[number]["id"]

export function SettingsDialog({
  open,
  onOpenChange,
  theme,
  onThemeChange,
  llmModels,
  selectedLlmModel,
  onSelectedLlmModelChange,
  providers,
  selectedProviderId,
  onProvidersChange,
  onSelectedProviderIdChange,
  visionModels,
  selectedVisionModel,
  onSelectedVisionModelChange,
  metadata
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>("appearance")
  const [showSidebar, setShowSidebar] = useState(true)
  const [apiUrl, setApiUrlState] = useState(getApiUrl())
  const [customModel, setCustomModel] = useState(selectedLlmModel)
  const [providerName, setProviderName] = useState("OpenAI Compatible")
  const [providerBaseUrl, setProviderBaseUrl] = useState(metadata?.llm.base_url || "https://api.openai.com/v1")
  const [providerApiKey, setProviderApiKey] = useState("")
  const [fetchedModels, setFetchedModels] = useState<string[]>([])
  const [fetchError, setFetchError] = useState("")
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const themesScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const selectedProvider = providers.find((provider) => provider.id === selectedProviderId)
    if (selectedProvider) {
      setProviderName(selectedProvider.name)
      setProviderBaseUrl(selectedProvider.baseUrl)
      setProviderApiKey(selectedProvider.apiKey)
      setFetchedModels(selectedProvider.models)
      setCustomModel(selectedLlmModel || selectedProvider.models[0] || "")
      setFetchError("")
      return
    }
    setProviderName("OpenAI Compatible")
    setProviderBaseUrl(metadata?.llm.base_url || "https://api.openai.com/v1")
    setProviderApiKey("")
    setFetchedModels([])
    setCustomModel(selectedLlmModel)
    setFetchError("")
  }, [open, providers, selectedProviderId, selectedLlmModel, metadata?.llm.base_url])

  if (!open) return null

  const scrollThemes = (direction: "left" | "right") => {
    themesScrollRef.current?.scrollBy({ left: direction === "left" ? -280 : 280, behavior: "smooth" })
  }

  const applyApiUrl = () => {
    setApiUrl(apiUrl)
    window.location.reload()
  }

  const saveProvider = (preferredModel?: string) => {
    if (!providerName.trim() || !providerBaseUrl.trim()) {
      setFetchError("Provider name and endpoint are required.")
      return
    }
    const selectedModel = preferredModel?.trim() || customModel.trim()
    const models = fetchedModels.length > 0 ? Array.from(new Set([selectedModel, ...fetchedModels].filter(Boolean))) : selectedModel ? [selectedModel] : []
    if (models.length === 0) {
      setFetchError("Fetch models or enter a model id before saving the provider.")
      return
    }
    const baseUrl = providerBaseUrl.trim().replace(/\/$/, "")
    const slug = `${providerName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${baseUrl.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(-18)}`
    const provider: LlmProviderConfig = {
      id: slug,
      name: providerName.trim(),
      baseUrl,
      apiKey: providerApiKey.trim(),
      models
    }
    const nextProviders = [...providers.filter((item) => item.id !== provider.id), provider]
    onProvidersChange(nextProviders)
    onSelectedProviderIdChange(provider.id)
    onSelectedLlmModelChange(selectedModel || provider.models[0])
    setCustomModel(selectedModel || provider.models[0])
    setFetchedModels(provider.models)
    setFetchError("")
  }

  const applyCustomModel = () => {
    const selectedModel = customModel.trim()
    if (!selectedModel) return
    if (providerName.trim() && providerBaseUrl.trim() && providerApiKey.trim()) {
      saveProvider(selectedModel)
      return
    }
    onSelectedLlmModelChange(selectedModel)
  }

  const fetchProviderModels = async () => {
    setFetchError("")
    setFetchedModels([])
    setIsFetchingModels(true)
    try {
      const models = await fetchOpenAICompatibleModels({ baseUrl: providerBaseUrl, apiKey: providerApiKey })
      setFetchedModels(models)
      if (models[0]) setCustomModel(models[0])
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Could not fetch models")
    } finally {
      setIsFetchingModels(false)
    }
  }

  const addProvider = () => {
    saveProvider()
  }

  const removeProvider = (providerId: string) => {
    const nextProviders = providers.filter((provider) => provider.id !== providerId)
    onProvidersChange(nextProviders)
    if (selectedProviderId === providerId) {
      onSelectedProviderIdChange(nextProviders[0]?.id || null)
      if (nextProviders[0]?.models[0]) onSelectedLlmModelChange(nextProviders[0].models[0])
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="h-[100dvh] w-full max-w-full border-none bg-transparent p-0 text-foreground shadow-none sm:h-[75vh] sm:max-h-[680px] sm:max-w-[900px] sm:rounded-3xl">
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-background sm:rounded-3xl sm:border sm:border-border/40 lg:flex-row">
          <button
            className="absolute right-4 top-4 z-50 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/50 hover:text-foreground focus-visible:outline-none"
            aria-label="Close settings"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>

          <aside className={cn("flex w-full flex-col bg-background pt-10 px-3 pb-3 overflow-y-auto scrollbar-hide lg:w-[240px] lg:border-r lg:border-border/40 lg:flex lg:bg-muted/10 lg:p-3", !showSidebar && "hidden")}>
            <div className="mb-3 mt-1 px-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground overflow-hidden border border-border/50">
                  F
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-base font-bold text-foreground">Foody</p>
                  <p className="truncate text-xs text-muted-foreground">Food-101 vision + RAG chat</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto">
              <div className="space-y-0">
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id)
                        if (window.innerWidth < 1024) setShowSidebar(false)
                      }}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-all",
                        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      <span className="flex-1 text-sm">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </nav>
          </aside>

          <section className={cn("flex-1 overflow-hidden bg-background", showSidebar && "hidden lg:flex lg:flex-col")}>
            <button type="button" onClick={() => setShowSidebar(true)} className="flex items-center gap-2 px-6 py-4 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden">
              <ChevronLeft className="h-4 w-4" />
              <span>Back to menu</span>
            </button>
            <div className="h-full overflow-y-auto scrollbar-hide p-5 lg:p-6">
              {activeTab === "appearance" && (
                <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-bottom-4">
                  <header className="flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-bold text-foreground">Appearance</h1>
                      <p className="text-sm text-muted-foreground mt-1">Tune Foody's Woozlet-style chat surface.</p>
                    </div>
                  </header>
                  <div className="rounded-3xl border border-border/50 bg-muted/20 p-4">
                    <div className="rounded-2xl border border-border/60 bg-background p-3 shadow-sm">
                      <div className="flex items-center justify-between border-b border-border/40 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted" />
                          <div>
                            <div className="h-2.5 w-20 rounded-full bg-foreground/80" />
                            <div className="mt-1.5 h-2 w-28 rounded-full bg-muted-foreground/30" />
                          </div>
                        </div>
                        <div className="h-7 w-24 rounded-2xl bg-muted" />
                      </div>
                      <div className="grid gap-3 py-4 sm:grid-cols-[1fr_145px]">
                        <div className="space-y-2">
                          <div className="h-3 w-40 rounded-full bg-primary/80" />
                          <div className="h-2.5 w-64 max-w-full rounded-full bg-muted-foreground/25" />
                          <div className="h-2.5 w-52 rounded-full bg-muted-foreground/20" />
                        </div>
                        <div className="h-24 rounded-2xl bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.22),transparent_65%),hsl(var(--muted))]" />
                      </div>
                      <div className="h-12 rounded-3xl border border-border bg-muted/50" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">Theme</span>
                    </div>
                    <div className="relative -mx-1">
                      <button onClick={() => scrollThemes("left")} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 size-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors bg-background/50 backdrop-blur-sm border border-border/50 shadow-sm">
                        <ChevronLeft className="size-5" />
                      </button>
                      <button onClick={() => scrollThemes("right")} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 size-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors bg-background/50 backdrop-blur-sm border border-border/50 shadow-sm">
                        <ChevronRight className="size-5" />
                      </button>
                      <div ref={themesScrollRef} className="overflow-x-auto pb-2 scrollbar-hide px-1">
                        <div className="flex gap-2" style={{ width: "max-content" }}>
                          {themes.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => onThemeChange(item.id)}
                              className={cn("relative rounded-2xl overflow-hidden transition-all shrink-0 w-36 group ring-offset-2 ring-offset-background border border-border/40", theme === item.id ? "ring-2 ring-primary scale-[0.98]" : "opacity-90 hover:opacity-100 hover:scale-[1.02]")}
                            >
                              <div className="h-20 p-2 flex" style={{ background: item.type === "dark" ? "#18181b" : "#fafafa" }}>
                                <div className="w-1/4 rounded-md mr-1.5" style={{ background: item.type === "dark" ? "#27272a" : "#e4e4e7" }} />
                                <div className="flex-1 flex flex-col gap-1">
                                  <div className="h-2.5 rounded-sm w-4/5" style={{ background: item.primaryColor }} />
                                  <div className="h-2 rounded-sm w-3/5" style={{ background: item.type === "dark" ? "#3f3f46" : "#d4d4d8" }} />
                                  <div className="h-2 rounded-sm w-2/3" style={{ background: item.type === "dark" ? "#3f3f46" : "#d4d4d8" }} />
                                  <div className="mt-auto h-4 rounded-full" style={{ background: item.type === "dark" ? "#27272a" : "#e4e4e7" }} />
                                </div>
                              </div>
                              <div className={cn("flex items-center justify-between px-2.5 py-2", theme === item.id ? "bg-primary/10 text-primary" : "bg-muted/20")}>
                                <span className="text-xs truncate font-medium">{item.name}</span>
                                {theme === item.id && <Check className="size-3 shrink-0" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "models" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <header>
                    <h2 className="text-xl font-bold text-foreground">Models</h2>
                      <p className="text-sm text-muted-foreground mt-1">Two clean layers: OpenAI-compatible streaming generation and image-only EfficientNetB3 vision.</p>
                  </header>
                  <section className="rounded-3xl border border-border/50 bg-muted/20 p-4 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">OpenAI-compatible providers</p>
                      <p className="mt-1 text-xs text-muted-foreground">Saved providers stay in this browser. Use an API key for hosted providers; local OpenAI-compatible endpoints can use a blank key.</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {providerPresets.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setProviderName(preset.name)
                            setProviderBaseUrl(preset.baseUrl)
                            setCustomModel(preset.model)
                            setFetchedModels([])
                            setFetchError("")
                          }}
                          className="rounded-full border border-border/50 bg-background px-3 py-1.5 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input value={providerName} onChange={(event) => setProviderName(event.target.value)} placeholder="Provider name" className="h-9 rounded-xl border border-border/50 bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
                      <input value={providerBaseUrl} onChange={(event) => setProviderBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" className="h-9 rounded-xl border border-border/50 bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring sm:col-span-2" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                      <input value={providerApiKey} onChange={(event) => setProviderApiKey(event.target.value)} placeholder="API key, optional for local" type="password" className="h-9 flex-1 rounded-xl border border-border/50 bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
                      <Button onClick={fetchProviderModels} size="sm" disabled={isFetchingModels}>{isFetchingModels ? "Fetching..." : "Fetch models"}</Button>
                      <Button onClick={addProvider} size="sm" variant="secondary">Save provider</Button>
                    </div>
                    <div className="flex gap-2">
                      <input value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder="model id, e.g. gpt-4o-mini" className="h-9 flex-1 rounded-xl border border-border/50 bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
                      <Button onClick={applyCustomModel} size="sm">Use</Button>
                    </div>
                    {fetchError && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{fetchError}</p>}
                    {fetchedModels.length > 0 && (
                      <div className="max-h-32 overflow-y-auto rounded-2xl border border-border/50 bg-background/50 p-2 scrollbar-hide">
                        <p className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">Fetched {fetchedModels.length} models</p>
                        <div className="flex flex-wrap gap-1.5">
                          {fetchedModels.slice(0, 30).map((model) => (
                            <button key={model} onClick={() => setCustomModel(model)} className={cn("rounded-full bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground", customModel === model && "bg-primary/10 text-primary")}>{model}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {providers.length > 0 && (
                      <div className="space-y-1.5 rounded-2xl border border-border/50 bg-background/40 p-2">
                        <p className="px-1 text-[11px] font-medium text-muted-foreground">Saved providers</p>
                        {providers.map((provider) => (
                          <div key={provider.id} className={cn("flex items-center gap-2 rounded-2xl border border-border/50 bg-card px-3 py-2", selectedProviderId === provider.id && "border-primary bg-primary/10")}>
                            <button className="min-w-0 flex-1 text-left" onClick={() => {
                              onSelectedProviderIdChange(provider.id)
                              if (provider.models[0]) onSelectedLlmModelChange(provider.models[0])
                            }}>
                              <p className="truncate text-sm font-medium text-foreground">{provider.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{provider.baseUrl} | {provider.models.length} models</p>
                            </button>
                            <button onClick={() => removeProvider(provider.id)} className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-destructive">Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-3xl border border-border/50 bg-muted/20 p-4 space-y-3">
                    <p className="text-xs text-muted-foreground font-medium">OpenAI-compatible chat model</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {llmModels.map((model) => (
                        <button key={model} onClick={() => onSelectedLlmModelChange(model)} className={cn("rounded-2xl border border-border/50 bg-card px-4 py-3 text-left text-sm transition hover:bg-muted/40", selectedLlmModel === model && "border-primary bg-primary/10 text-primary")}>
                          {model}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder="custom-model-id" className="h-9 flex-1 rounded-xl border border-border/50 bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
                      <Button onClick={applyCustomModel} size="sm">Use</Button>
                    </div>
                  </section>
                  <section className="rounded-3xl border border-border/50 bg-muted/20 p-4 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Food vision model</p>
                      <p className="mt-1 text-xs text-muted-foreground">This model is used only when an image is attached. Text-only chat never runs image inference.</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {visionModels.map((model) => (
                        <button key={model.id} onClick={() => onSelectedVisionModelChange(model.id)} className={cn("rounded-2xl border border-border/50 bg-card px-4 py-3 text-left text-sm transition hover:bg-muted/40", selectedVisionModel === model.id && "border-primary bg-primary/10 text-primary")}>
                          <span className="block font-medium">{model.name}</span>
                          {model.description && <span className="mt-1 block text-xs text-muted-foreground">{model.description}</span>}
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-3xl border border-border/50 bg-muted/20 p-4 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Backend API URL</p>
                    <div className="flex gap-2">
                      <input value={apiUrl} onChange={(event) => setApiUrlState(event.target.value)} className="h-9 flex-1 rounded-xl border border-border/50 bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
                      <Button onClick={applyApiUrl} size="sm">Save</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Provider API keys are saved in browser local storage and sent to the Foody backend only when you chat or fetch models.</p>
                  </section>
                </div>
              )}

              {activeTab === "data" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <header>
                    <h2 className="text-xl font-bold text-foreground">RAG + Data</h2>
                    <p className="text-sm text-muted-foreground mt-1">Foody retrieves local Food-101, model, recipe, metric, and Nutrition5k context before generation.</p>
                  </header>
                  <div className="rounded-3xl border border-dashed border-border/50 bg-muted/20 p-6 text-sm text-muted-foreground">
                    RAG sources live in `foody/knowledge`, Food-101 class metadata, Nutrition5k metadata, split CSVs, and model comparison metrics. Assistant answers require a working OpenAI-compatible provider.
                    {metadata ? <span className="mt-3 block">Loaded RAG chunks: {metadata.rag_chunks}. Active backend default: {metadata.llm.default_model}.</span> : null}
                  </div>
                </div>
              )}

              {activeTab === "about" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <header>
                    <h2 className="text-xl font-bold text-foreground">About Foody</h2>
                    <p className="text-sm text-muted-foreground mt-1">A clean Food-101 recognition and recipe RAG assistant with a Woozlet-style chat interface.</p>
                  </header>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
