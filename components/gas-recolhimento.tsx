"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/lib/utils"
import { IndicadorProgresso } from "@/components/indicador-progresso"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RotateCcw, RefreshCw, Loader2, Download, Clock, Save, AlertCircle, Wifi, WifiOff } from "lucide-react"
import { persistentStorageService } from "@/lib/persistent-storage-service"
import { realtimeSyncService } from "@/lib/realtime-sync-service"
import { networkDiagnostic } from "@/lib/network-diagnostic"
import type { EntradaGas, EstadoAplicacao } from "@/lib/types"

// Verificar se estamos no navegador
const isBrowser = typeof window !== "undefined"

export default function GasRecolhimento() {
  const [gasRetirado, setGasRetirado] = useState<string>("")
  const [operador, setOperador] = useState<string>("")
  const [acumulado, setAcumulado] = useState<number>(0)
  const [rodada, setRodada] = useState<number>(1)
  const [historico, setHistorico] = useState<EntradaGas[]>([])
  const [error, setError] = useState<string | null>(null)
  const [carregando, setCarregando] = useState<boolean>(true)
  const [processando, setProcessando] = useState<boolean>(false)
  const [sincronizando, setSincronizando] = useState<boolean>(false)
  const [historicoAberto, setHistoricoAberto] = useState<boolean>(false)
  const [statusConexao, setStatusConexao] = useState<"online" | "offline" | "local" | "error">("online")
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<string | null>(null)
  const [confirmarRegistro, setConfirmarRegistro] = useState<boolean>(false)
  const [confirmarTrocaCilindro, setConfirmarTrocaCilindro] = useState<boolean>(false)
  const [confirmarDesfazer, setConfirmarDesfazer] = useState<boolean>(false)
  const [sincronizacaoAutomatica, setSincronizacaoAutomatica] = useState<boolean>(true)
  const [alertaSalvamento, setAlertaSalvamento] = useState<boolean>(false)
  const [statusSincronizacao, setStatusSincronizacao] = useState<"idle" | "syncing" | "error" | "success">("idle")
  const [apiAvailable, setApiAvailable] = useState<boolean>(true)

  // Referência para o estado atual para uso em temporizadores
  const stateRef = useRef({ acumulado, rodada, historico })

  // Atualizar referência quando o estado mudar
  useEffect(() => {
    stateRef.current = { acumulado, rodada, historico }
  }, [acumulado, rodada, historico])

  // Verificar disponibilidade da API
  const checkApiAvailability = useCallback(async () => {
    if (!isBrowser) return

    try {
      const result = await networkDiagnostic.checkApiAvailability("/api/realtime-db")
      setApiAvailable(result.available)

      if (!result.available) {
        setStatusConexao("error")
        setError(`API indisponível: ${result.error}`)
      } else {
        setStatusConexao(navigator.onLine ? "online" : "offline")
      }
    } catch (error) {
      console.error("Erro ao verificar disponibilidade da API:", error)
    }
  }, [])

  // Inicializar polling para atualizações em tempo real
  useEffect(() => {
    if (!isBrowser || !sincronizacaoAutomatica) return

    // Função para atualizar dados quando receber atualizações
    const handleDataUpdate = (data: EstadoAplicacao) => {
      // Verificar se os dados são diferentes dos atuais
      const currentState = stateRef.current

      // Se os dados recebidos forem diferentes, atualizar o estado
      if (
        data.historico.length !== currentState.historico.length ||
        data.acumulado !== currentState.acumulado ||
        data.rodada !== currentState.rodada
      ) {
        console.log("Recebida atualização em tempo real")
        setAcumulado(data.acumulado)
        setRodada(data.rodada)
        setHistorico(data.historico)
        setUltimaSincronizacao(new Date().toISOString())

        // Mostrar alerta de atualização
        setAlertaSalvamento(true)
        setTimeout(() => setAlertaSalvamento(false), 3000)
      }
    }

    // Iniciar polling
    realtimeSyncService.startPolling(handleDataUpdate)

    // Limpar ao desmontar
    return () => {
      realtimeSyncService.stopPolling()
    }
  }, [sincronizacaoAutomatica])

  // Monitorar status de conexão
  useEffect(() => {
    if (!isBrowser) return

    const handleOnline = () => {
      setStatusConexao("online")
      checkApiAvailability().then(() => {
        if (apiAvailable) {
          sincronizarDados()
        }
      })
    }
    const handleOffline = () => setStatusConexao("offline")

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    setStatusConexao(navigator.onLine ? "online" : "offline")

    // Verificar disponibilidade da API periodicamente
    const apiCheckInterval = setInterval(checkApiAvailability, 30000) // A cada 30 segundos

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(apiCheckInterval)
    }
  }, [checkApiAvailability, apiAvailable])

  // Sincronizar dados com o servidor
  const sincronizarDados = useCallback(async () => {
    if (!isBrowser || !navigator.onLine || sincronizando) return

    setSincronizando(true)
    setStatusSincronizacao("syncing")
    setError(null)

    try {
      // Verificar disponibilidade da API
      const apiStatus = await networkDiagnostic.checkApiAvailability("/api/realtime-db")
      setApiAvailable(apiStatus.available)

      if (!apiStatus.available) {
        throw new Error(`API indisponível: ${apiStatus.error}`)
      }

      // Obter dados atuais
      const { acumulado, rodada, historico } = stateRef.current

      // Criar objeto de estado
      const estado = { acumulado, rodada, historico }

      // Enviar dados imediatamente
      await realtimeSyncService.sendDataImmediate(estado)

      setUltimaSincronizacao(new Date().toISOString())
      setStatusConexao("online")
      setStatusSincronizacao("success")
      console.log("Sincronização manual concluída com sucesso")

      // Mostrar alerta de sincronização bem-sucedida
      setAlertaSalvamento(true)
      setTimeout(() => setAlertaSalvamento(false), 3000)
    } catch (error) {
      console.error("Erro na sincronização manual:", error)
      setStatusConexao("error")
      setStatusSincronizacao("error")
      setError(`Erro ao sincronizar: ${error.message || "Desconhecido"}. Tente novamente mais tarde.`)

      // Salvar localmente mesmo em caso de erro
      const { acumulado, rodada, historico } = stateRef.current
      persistentStorageService.saveToLocalStorage({ acumulado, rodada, historico })
    } finally {
      setSincronizando(false)

      // Resetar status de sucesso após 3 segundos
      if (statusSincronizacao === "success") {
        setTimeout(() => {
          setStatusSincronizacao("idle")
        }, 3000)
      }
    }
  }, [sincronizando, statusSincronizacao])

  // Carregar dados iniciais
  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setError(null)

    try {
      // Tentar carregar dados do serviço em tempo real
      const dados = await realtimeSyncService.fetchLatestData()

      if (dados && typeof dados.acumulado === "number" && Array.isArray(dados.historico)) {
        setAcumulado(dados.acumulado)
        setRodada(dados.rodada)
        setHistorico(dados.historico)
        setUltimaSincronizacao(new Date().toISOString())
        setStatusConexao(navigator.onLine ? "online" : "local")
      } else {
        throw new Error("Dados inválidos recebidos")
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      setError("Erro ao carregar dados. Usando dados locais.")
      setStatusConexao("local")

      // Tentar carregar do localStorage como fallback
      const localData = persistentStorageService.loadFromLocalStorage()
      setAcumulado(localData.acumulado)
      setRodada(localData.rodada)
      setHistorico(localData.historico)
    } finally {
      setCarregando(false)
    }
  }, [])

  // Carregar dados ao iniciar
  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const validarEntrada = () => {
    if (!gasRetirado || isNaN(Number(gasRetirado)) || Number(gasRetirado) <= 0) {
      setError("Por favor, insira um valor válido maior que zero.")
      return false
    }
    if (!operador.trim()) {
      setError("Por favor, informe o nome do operador.")
      return false
    }
    setError(null)
    return true
  }

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (validarEntrada()) {
      setConfirmarRegistro(true)
    }
  }

  const registrarGas = async () => {
    setConfirmarRegistro(false)
    setProcessando(true)
    setError(null)

    try {
      const quantidade = Number(gasRetirado)
      const novaEntrada: EntradaGas = {
        id: Date.now().toString(),
        quantidade,
        acumulado: acumulado + quantidade,
        rodada,
        operador: operador.trim(),
        data: new Date().toISOString(),
      }

      const novoEstado = {
        acumulado: acumulado + quantidade,
        rodada,
        historico: [novaEntrada, ...historico],
      }

      // Atualizar estado local
      setAcumulado(novoEstado.acumulado)
      setRodada(novoEstado.rodada)
      setHistorico(novoEstado.historico)
      setGasRetirado("")

      // Salvar dados localmente
      persistentStorageService.saveToLocalStorage(novoEstado)

      // Tentar sincronizar imediatamente se online e API disponível
      if (navigator.onLine && apiAvailable) {
        try {
          // Enviar dados para sincronização em tempo real
          await realtimeSyncService.sendDataImmediate(novoEstado)
          setUltimaSincronizacao(new Date().toISOString())
          setStatusConexao("online")
        } catch (syncError) {
          console.error("Erro ao sincronizar:", syncError)
          setStatusConexao("local")
          setError("Registro salvo localmente. Sincronização automática falhou.")
        }
      } else {
        setStatusConexao("local")
        if (!navigator.onLine) {
          setError("Dispositivo offline. Registro salvo localmente. Sincronize quando possível.")
        } else if (!apiAvailable) {
          setError("API indisponível. Registro salvo localmente. Sincronize quando possível.")
        } else {
          setError("Registro salvo localmente. Sincronize quando possível.")
        }
      }
    } catch (error) {
      console.error("Erro ao registrar gás:", error)
      setError(`Erro ao registrar: ${error.message || "Desconhecido"}. Dados salvos localmente.`)
      setStatusConexao("local")
    } finally {
      setProcessando(false)
    }
  }

  const trocarCilindro = async () => {
    setConfirmarTrocaCilindro(false)
    setProcessando(true)
    setError(null)

    try {
      const novaEntrada: EntradaGas = {
        id: Date.now().toString(),
        quantidade: 0,
        acumulado: 0,
        rodada: rodada + 1,
        data: new Date().toISOString(),
        operador: operador.trim(),
        valorFinalRodada: acumulado,
        trocaCilindro: true,
      }

      const novoEstado = {
        acumulado: 0,
        rodada: rodada + 1,
        historico: [novaEntrada, ...historico],
      }

      // Atualizar estado local
      setAcumulado(novoEstado.acumulado)
      setRodada(novoEstado.rodada)
      setHistorico(novoEstado.historico)

      // Salvar dados localmente
      persistentStorageService.saveToLocalStorage(novoEstado)

      // Tentar sincronizar imediatamente se online e API disponível
      if (navigator.onLine && apiAvailable) {
        try {
          // Enviar dados para sincronização em tempo real
          await realtimeSyncService.sendDataImmediate(novoEstado)
          setUltimaSincronizacao(new Date().toISOString())
          setStatusConexao("online")
        } catch (syncError) {
          console.error("Erro ao sincronizar:", syncError)
          setStatusConexao("local")
          setError("Troca de cilindro registrada localmente. Sincronização automática falhou.")
        }
      } else {
        setStatusConexao("local")
        if (!navigator.onLine) {
          setError("Dispositivo offline. Troca de cilindro registrada localmente. Sincronize quando possível.")
        } else if (!apiAvailable) {
          setError("API indisponível. Troca de cilindro registrada localmente. Sincronize quando possível.")
        } else {
          setError("Troca de cilindro registrada localmente. Sincronize quando possível.")
        }
      }
    } catch (error) {
      console.error("Erro ao trocar cilindro:", error)
      setError(`Erro ao trocar cilindro: ${error.message || "Desconhecido"}. Dados salvos localmente.`)
      setStatusConexao("local")
    } finally {
      setProcessando(false)
    }
  }

  const desfazerUltimoRegistro = async () => {
    setConfirmarDesfazer(false)
    setProcessando(true)
    setError(null)

    try {
      if (historico.length === 0) throw new Error("Não há entradas para desfazer")

      const ultimaEntrada = historico[0]
      const novoHistorico = [...historico]
      novoHistorico.shift()

      let novoAcumulado = acumulado
      let novaRodada = rodada

      if (ultimaEntrada.trocaCilindro) {
        novaRodada = rodada - 1
        novoAcumulado = ultimaEntrada.valorFinalRodada || 0
      } else if (ultimaEntrada.valorFinalRodada) {
        novaRodada = rodada - 1
        novoAcumulado = ultimaEntrada.valorFinalRodada - ultimaEntrada.quantidade
      } else {
        novoAcumulado = acumulado - ultimaEntrada.quantidade
      }

      const novoEstado = {
        acumulado: novoAcumulado,
        rodada: novaRodada,
        historico: novoHistorico,
      }

      // Atualizar estado local
      setAcumulado(novoEstado.acumulado)
      setRodada(novoEstado.rodada)
      setHistorico(novoEstado.historico)

      // Salvar dados localmente
      persistentStorageService.saveToLocalStorage(novoEstado)

      // Tentar sincronizar imediatamente se online e API disponível
      if (navigator.onLine && apiAvailable) {
        try {
          // Enviar dados para sincronização em tempo real
          await realtimeSyncService.sendDataImmediate(novoEstado)
          setUltimaSincronizacao(new Date().toISOString())
          setStatusConexao("online")
        } catch (syncError) {
          console.error("Erro ao sincronizar:", syncError)
          setStatusConexao("local")
          setError("Operação desfeita localmente. Sincronização automática falhou.")
        }
      } else {
        setStatusConexao("local")
        if (!navigator.onLine) {
          setError("Dispositivo offline. Operação desfeita localmente. Sincronize quando possível.")
        } else if (!apiAvailable) {
          setError("API indisponível. Operação desfeita localmente. Sincronize quando possível.")
        } else {
          setError("Operação desfeita localmente. Sincronize quando possível.")
        }
      }
    } catch (error) {
      console.error("Erro ao desfazer registro:", error)
      setError(`Não foi possível desfazer o último registro: ${error.message || "Erro desconhecido"}`)
    } finally {
      setProcessando(false)
    }
  }

  const exportarHistorico = () => {
    try {
      persistentStorageService.downloadCSV(historico)
    } catch (error) {
      console.error("Erro ao exportar histórico:", error)
      setError("Não foi possível exportar o histórico.")
    }
  }

  const formatLastSync = () => {
    if (!ultimaSincronizacao) return "Nunca"
    try {
      return new Date(ultimaSincronizacao).toLocaleString("pt-BR")
    } catch {
      return "Desconhecido"
    }
  }

  const getStatusDisplay = () => {
    switch (statusConexao) {
      case "online":
        return {
          text: "Online",
          bgColor: "bg-green-50",
          textColor: "text-green-700",
          dotColor: "bg-green-500",
          icon: <Wifi className="h-4 w-4 mr-2" />,
        }
      case "offline":
        return {
          text: "Offline - Algumas funções podem estar limitadas",
          bgColor: "bg-amber-50",
          textColor: "text-amber-700",
          dotColor: "bg-amber-500",
          icon: <WifiOff className="h-4 w-4 mr-2" />,
        }
      case "local":
        return {
          text: "Modo Local - Dados salvos localmente",
          bgColor: "bg-blue-50",
          textColor: "text-blue-700",
          dotColor: "bg-blue-500",
          icon: <Save className="h-4 w-4 mr-2" />,
        }
      case "error":
        return {
          text: "Erro de Conexão - API indisponível",
          bgColor: "bg-red-50",
          textColor: "text-red-700",
          dotColor: "bg-red-500",
          icon: <AlertCircle className="h-4 w-4 mr-2" />,
        }
      default:
        return {
          text: "Desconhecido",
          bgColor: "bg-gray-50",
          textColor: "text-gray-700",
          dotColor: "bg-gray-500",
          icon: null,
        }
    }
  }

  const getSyncButtonState = () => {
    switch (statusSincronizacao) {
      case "syncing":
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: "Sincronizando...",
          disabled: true,
          variant: "ghost" as const,
        }
      case "error":
        return {
          icon: <RefreshCw className="h-3 w-3" />,
          text: "Tentar novamente",
          disabled: false,
          variant: "outline" as const,
        }
      case "success":
        return {
          icon: <RefreshCw className="h-3 w-3" />,
          text: "Sincronizado",
          disabled: true,
          variant: "ghost" as const,
        }
      default:
        return {
          icon: <RefreshCw className="h-3 w-3" />,
          text: "Sincronizar",
          disabled: false,
          variant: "ghost" as const,
        }
    }
  }

  const cilindroAtingiuLimite = acumulado >= 10000
  const status = getStatusDisplay()
  const syncButtonState = getSyncButtonState()

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Carregando dados...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4">
          <AlertCircle className="h-4 w-4 inline-block mr-2" />
          {error}
          <button className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
            <span className="sr-only">Fechar</span>
            <span className="text-xl">&times;</span>
          </button>
        </div>
      )}

      {alertaSalvamento && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative mb-4 flex items-center">
          <Save className="h-4 w-4 mr-2" />
          Dados sincronizados com sucesso
          <button className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setAlertaSalvamento(false)}>
            <span className="sr-only">Fechar</span>
            <span className="text-xl">&times;</span>
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recolhedora R410-A</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="operador">Nome do Operador</Label>
                <Input
                  id="operador"
                  type="text"
                  value={operador}
                  onChange={(e) => setOperador(e.target.value)}
                  placeholder="Digite seu nome"
                  disabled={processando}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gasRetirado">Gás Retirado (g)</Label>
                <Input
                  id="gasRetirado"
                  type="number"
                  value={gasRetirado}
                  onChange={(e) => setGasRetirado(e.target.value)}
                  placeholder="Digite a quantidade em gramas"
                  disabled={processando}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={processando}>
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Registrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Acumulado</p>
                <p className="text-2xl font-bold">{acumulado} g</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Rodada</p>
                <p className="text-2xl font-bold">{rodada}</p>
              </div>
            </div>

            <IndicadorProgresso
              valor={acumulado}
              maximo={10000}
              titulo="Progresso"
              subtitulo="Limite de 10kg por rodada"
            />

            {cilindroAtingiuLimite && (
              <Button
                variant="destructive"
                className="w-full mt-2 flex items-center justify-center"
                onClick={() => setConfirmarTrocaCilindro(true)}
                disabled={processando}
              >
                {processando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Trocar Cilindro
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Sheet open={historicoAberto} onOpenChange={setHistoricoAberto}>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex-1" disabled={processando}>
              Histórico
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Histórico de Recolhimento</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-12rem)] mt-6">
              {historico.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Operador</TableHead>
                      <TableHead className="text-right">Retirado</TableHead>
                      <TableHead className="text-right">Acumulado</TableHead>
                      <TableHead className="text-right">Rodada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((entrada) => (
                      <TableRow key={entrada.id}>
                        <TableCell>{formatDate(entrada.data)}</TableCell>
                        <TableCell>{entrada.operador || "Não informado"}</TableCell>
                        <TableCell className="text-right">
                          {entrada.trocaCilindro ? (
                            <span className="text-blue-600 font-medium">Troca de Cilindro</span>
                          ) : (
                            `${entrada.quantidade} g`
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {entrada.acumulado} g
                          {entrada.valorFinalRodada && (
                            <div className="text-xs text-green-600 font-medium">
                              Fim da rodada: {entrada.valorFinalRodada} g
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{entrada.rodada}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-4">Nenhum registro encontrado.</p>
              )}
            </ScrollArea>
            <SheetFooter className="mt-4">
              <Button onClick={exportarHistorico} disabled={historico.length === 0} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setConfirmarDesfazer(true)}
          disabled={historico.length === 0 || processando}
        >
          {processando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <RotateCcw className="h-4 w-4 mr-2" />
              Desfazer
            </>
          )}
        </Button>
      </div>

      <div className="mt-8 pt-4 border-t border-gray-200">
        <div
          className={`text-sm font-medium flex items-center justify-center p-2 rounded-md ${status.bgColor} ${status.textColor}`}
        >
          {status.icon}
          {status.text}
          {statusConexao !== "offline" && (
            <Button
              variant={syncButtonState.variant}
              size="sm"
              className="ml-2 h-6 px-2"
              onClick={sincronizarDados}
              disabled={syncButtonState.disabled}
            >
              {syncButtonState.icon}
              <span className="ml-1 text-xs">{syncButtonState.text}</span>
            </Button>
          )}
        </div>
        <div className="text-xs text-center text-muted-foreground flex items-center justify-center mt-2">
          <Clock className="h-3 w-3 mr-1" />
          Última sincronização: {formatLastSync()}
        </div>
      </div>

      {/* Diálogo de confirmação de registro */}
      <Dialog open={confirmarRegistro} onOpenChange={setConfirmarRegistro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar registro</DialogTitle>
            <DialogDescription>
              Você está prestes a registrar {gasRetirado}g de gás retirado por {operador}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarRegistro(false)} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={registrarGas} disabled={processando}>
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação de desfazer */}
      <Dialog open={confirmarDesfazer} onOpenChange={setConfirmarDesfazer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desfazer último registro</DialogTitle>
            <DialogDescription>
              {historico.length > 0 ? (
                <>
                  Você está prestes a desfazer{" "}
                  {historico[0].trocaCilindro ? "a troca de cilindro" : `o registro de ${historico[0].quantidade}g`}{" "}
                  feito por {historico[0].operador || "operador não identificado"}.
                </>
              ) : (
                "Não há registros para desfazer."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarDesfazer(false)} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={desfazerUltimoRegistro} disabled={processando || historico.length === 0}>
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação de troca de cilindro */}
      <Dialog open={confirmarTrocaCilindro} onOpenChange={setConfirmarTrocaCilindro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar troca de cilindro</DialogTitle>
            <DialogDescription>
              Você está prestes a registrar uma troca de cilindro. O acumulado atual de {acumulado}g será registrado
              como o valor final da rodada {rodada} e uma nova rodada será iniciada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarTrocaCilindro(false)} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={trocarCilindro} disabled={processando}>
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
