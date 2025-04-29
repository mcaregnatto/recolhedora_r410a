// Serviço para diagnóstico de problemas de rede
export const networkDiagnostic = {
  // Verificar se a API está acessível
  async checkApiAvailability(endpoint = "/api/health"): Promise<{
    available: boolean
    latency?: number
    error?: string
  }> {
    if (typeof window === "undefined") {
      return { available: false, error: "Executando no servidor" }
    }

    if (!navigator.onLine) {
      return { available: false, error: "Dispositivo offline" }
    }

    try {
      const startTime = performance.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 segundos de timeout

      const response = await fetch(endpoint, {
        method: "HEAD",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const endTime = performance.now()
      const latency = Math.round(endTime - startTime)

      if (!response.ok) {
        return {
          available: false,
          latency,
          error: `API respondeu com status ${response.status}`,
        }
      }

      return { available: true, latency }
    } catch (error) {
      if (error.name === "AbortError") {
        return { available: false, error: "Timeout ao verificar API" }
      }
      return { available: false, error: `Erro ao verificar API: ${error.message || "Desconhecido"}` }
    }
  },

  // Verificar a qualidade da conexão
  getConnectionQuality(): "unknown" | "slow" | "medium" | "fast" {
    if (typeof window === "undefined" || !navigator.connection) {
      return "unknown"
    }

    // @ts-ignore - Alguns navegadores suportam navigator.connection
    const connection = navigator.connection

    if (connection.saveData) {
      return "slow" // Modo de economia de dados ativado
    }

    if (connection.effectiveType) {
      switch (connection.effectiveType) {
        case "slow-2g":
        case "2g":
          return "slow"
        case "3g":
          return "medium"
        case "4g":
          return "fast"
        default:
          return "unknown"
      }
    }

    return "unknown"
  },

  // Registrar informações de diagnóstico
  async logDiagnosticInfo(): Promise<Record<string, any>> {
    const diagnosticInfo = {
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "server",
      online: typeof window !== "undefined" ? navigator.onLine : false,
      connectionQuality: this.getConnectionQuality(),
      apiStatus: await this.checkApiAvailability(),
    }

    console.log("Informações de diagnóstico:", diagnosticInfo)
    return diagnosticInfo
  },
}
