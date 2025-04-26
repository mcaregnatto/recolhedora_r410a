"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
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
import { AlertTriangle, RotateCcw, RefreshCw, Loader2, Download, RefreshCcw, Clock } from "lucide-react"
import { memoryStorageService } from "@/lib/memory-storage-service"
import type { EntradaGas } from "@/lib/types"

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
  const [statusConexao, setStatusConexao] = useState<"online" | "offline" | "local">("online")
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<string | null>(null)
  const [confirmarRegistro, setConfirmarRegistro] = useState<boolean>(false)
  const [confirmarTrocaCilindro, setConfirmarTrocaCilindro] = useState<boolean>(false)
  const [confirmarDesfazer, setConfirmarDesfazer] = useState<boolean>(false)

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => {
      setStatusConexao("online")
      // Tente sincronizar quando voltar online
      sincronizarDados()
    }
    const handleOffline = () => setStatusConexao("offline")

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Set initial status
    setStatusConexao(navigator.onLine ? "online" : "offline")

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Função para carregar dados - memoizada para evitar recriações
  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setError(null)

    try {
      console.log("Carregando dados...")
      const dados = await memoryStorageService.carregar()
      console.log("Dados carregados")

      // Verificar se os dados são válidos
      if (dados && typeof dados.acumulado === "number" && Array.isArray(dados.historico)) {
        setAcumulado(dados.acumulado)
        setRodada(dados.rodada)
        setHistorico(dados.historico)
        setUltimaSincronizacao(new Date().toISOString())
      } else {
        throw new Error("Dados inválidos recebidos")
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      setError("Não foi possível carregar os dados. Usando dados locais.")
      setStatusConexao("local")

      // Tentar carregar do localStorage como último recurso
      const localData = memoryStorageService.loadFromLocalStorage()
      if (localData && Array.isArray(localData.historico)) {
        setAcumulado(localData.acumulado)
        setRodada(localData.rodada)
        setHistorico(localData.historico)
      }
    } finally {
      setCarregando(false)
    }
  }, [])

  // Load data on start
  useEffect(() => {
    carregarDados()

    // Configurar verificação periódica para garantir que os dados não sejam perdidos
    const intervalId = setInterval(() => {
      // Verificar se temos dados no estado e se eles correspondem ao localStorage
      const localData = memoryStorageService.loadFromLocalStorage()

      // Se não tivermos histórico no estado, mas tivermos no localStorage, recarregue
      if (historico.length === 0 && localData.historico.length > 0) {
        console.log("Detectada perda de dados no estado, recarregando do localStorage")
        setAcumulado(localData.acumulado)
        setRodada(localData.rodada)
        setHistorico(localData.historico)
      }

      // Se estivermos online, tente sincronizar com o servidor periodicamente
      if (navigator.onLine && !sincronizando && !processando) {
        memoryStorageService.syncToServer(localData).catch(console.error)
      }
    }, 30000) // Verificar a cada 30 segundos

    return () => clearInterval(intervalId)
  }, [carregarDados, historico.length, sincronizando, processando])

  // Update last sync time
  useEffect(() => {
    const lastSync = memoryStorageService.getLastSyncTime()
    if (lastSync) {
      setUltimaSincronizacao(lastSync)
    }
  }, [sincronizando])

  // Function to synchronize data
  const sincronizarDados = async () => {
    if (statusConexao === "offline") {
      setError("Não é possível sincronizar dados sem conexão com a internet.")
      return
    }

    setSincronizando(true)
    setError(null)

    try {
      await carregarDados()
      setStatusConexao("online")
      setError(null)
    } catch (error) {
      console.error("Erro ao sincronizar dados:", error)
      setError("Não foi possível sincronizar os dados. Usando dados locais.")
      setStatusConexao("local")
    } finally {
      setSincronizando(false)
    }
  }

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
      const novoAcumulado = acumulado + quantidade

      const novaEntrada: EntradaGas = {
        id: Date.now().toString(),
        quantidade,
        acumulado: novoAcumulado,
        rodada,
        operador: operador.trim(),
        data: new Date().toISOString(),
      }

      const novoEstado = {
        acumulado: novoAcumulado,
        rodada,
        historico: [novaEntrada, ...historico],
      }

      // Atualiza visualmente na hora
      setAcumulado(novoAcumulado)
      setRodada(rodada)
      setHistorico([novaEntrada, ...historico])
      setUltimaSincronizacao(new Date().toISOString())

      // Salva no servidor em background
      memoryStorageService.salvar(novoEstado)
        .then(() => {
          setStatusConexao("online")
        })
        .catch((error) => {
          console.error("Erro ao salvar no servidor:", error)
          memoryStorageService.saveToLocalStorage(novoEstado)
          setStatusConexao("local")
          setError(
            "Dados salvos apenas localmente. Sincronize quando estiver online para compartilhar com outros usuários."
          )
        })

      setGasRetirado("")
    } catch (error) {
      console.error("Erro ao registrar gás:", error)
      setError(
        "Erro interno ao tentar registrar a entrada. Tente novamente."
      )
    } finally {
      setProcessando(false)
    }
  }

  const trocarCilindro = async () => {
    setConfirmarTrocaCilindro(false)
    setProcessando(true)
    setError(null)

    try {
      const novaRodada = rodada + 1

      const novaEntrada: EntradaGas = {
        id: Date.now().toString(),
        quantidade: 0,
        acumulado: 0,
        rodada: novaRodada,
        data: new Date().toISOString(),
        operador: operador.trim(),
        valorFinalRodada: acumulado,
        trocaCilindro: true,
      }

      const novoEstado = {
        acumulado: 0,
        rodada: novaRodada,
        historico: [novaEntrada, ...historico],
      }

      // Atualiza instantaneamente
      setAcumulado(0)
      setRodada(novaRodada)
      setHistorico([novaEntrada, ...historico])
      setUltimaSincronizacao(new Date().toISOString())

      // Salva no servidor em segundo plano
      memoryStorageService.salvar(novoEstado)
        .then(() => {
          setStatusConexao("online")
        })
        .catch((error) => {
          console.error("Erro ao salvar no servidor:", error)
          memoryStorageService.saveToLocalStorage(novoEstado)
          setStatusConexao("local")
          setError(
            "Troca de cilindro salva apenas localmente. Sincronize quando estiver online para compartilhar com outros usuários."
          )
        })

    } catch (error) {
      console.error("Erro ao trocar cilindro:", error)
      setError("Erro interno ao tentar trocar o cilindro. Tente novamente.")
    } finally {
      setProcessando(false)
    }
  }

  const desfazerUltimoRegistro = async () => {
    setConfirmarDesfazer(false)
    setProcessando(true)
    setError(null)

    try {
      if (historico.length === 0) {
        throw new Error("Não há entradas para desfazer")
      }

      const ultimaEntrada = historico[0]
      const novoHistorico = [...historico]
      novoHistorico.shift()

      let novoAcumulado = acumulado
      let novaRodada = rodada

      if (ultimaEntrada.trocaCilindro) {
        novaRodada = novaRodada - 1
        novoAcumulado = ultimaEntrada.valorFinalRodada || 0
      } else if (ultimaEntrada.valorFinalRodada) {
        novaRodada = novaRodada - 1
        novoAcumulado = (ultimaEntrada.valorFinalRodada || 0) - (ultimaEntrada.quantidade || 0)
      } else {
        novoAcumulado = novoAcumulado - (ultimaEntrada.quantidade || 0)
      }

      const novoEstado = {
        acumulado: novoAcumulado,
        rodada: novaRodada,
        historico: novoHistorico,
      }

      // Atualiza instantaneamente
      setAcumulado(novoAcumulado)
      setRodada(novaRodada)
      setHistorico(novoHistorico)
      setUltimaSincronizacao(new Date().toISOString())

      // Salva no servidor em segundo plano
      memoryStorageService.salvar(novoEstado)
        .then(() => {
          setStatusConexao("online")
        })
        .catch((error) => {
          console.error("Erro ao salvar no servidor:", error)
          memoryStorageService.saveToLocalStorage(novoEstado)
          setStatusConexao("local")
          setError(
            "Operação de desfazer salva apenas localmente. Sincronize quando estiver online para compartilhar com outros usuários."
          )
        })

    } catch (error) {
      console.error("Erro ao desfazer registro:", error)
      setError(
        "Não foi possível desfazer o último registro. " +
        (error instanceof Error ? error.message : "Por favor, tente novamente."),
      )
    } finally {
      setProcessando(false)
    }
  }

  const exportarHistorico = () => {
    try {
      memoryStorageService.downloadCSV(historico)
    } catch (error) {
      console.error("Erro ao exportar histórico:", error)
      setError("Não foi possível exportar o histórico. Por favor, tente novamente.")
    }
  }

  // Format last sync time
  const formatLastSync = () => {
    if (!ultimaSincronizacao) return "Nunca"

    try {
      return new Date(ultimaSincronizacao).toLocaleString("pt-BR")
    } catch (e) {
      return "Desconhecido"
    }
  }

  // Get status display
  const getStatusDisplay = () => {
    switch (statusConexao) {
      case "online":
        return { text: "Online", bgColor: "bg-green-50", textColor: "text-green-700", dotColor: "bg-green-500" }
      case "offline":
        return {
          text: "Offline - Algumas funções podem estar limitadas",
          bgColor: "bg-amber-50",
          textColor: "text-amber-700",
          dotColor: "bg-amber-500",
        }
      case "local":
        return {
          text: "Modo Local - Dados salvos apenas localmente",
          bgColor: "bg-blue-50",
          textColor: "text-blue-700",
          dotColor: "bg-blue-500",
        }
      default:
        return { text: "Desconhecido", bgColor: "bg-gray-50", textColor: "text-gray-700", dotColor: "bg-gray-500" }
    }
  }

  // Check if cylinder is full (accumulated >= 10000)
  const cilindroAtingiuLimite = acumulado >= 10000
  const status = getStatusDisplay()

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
          {error}
          <button className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
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
              subtitulo="Progresso: Limite de 10kg por rodada"
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

      {/* Status indicators moved to bottom */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        {/* Connection status indicator */}
        <div
          className={`text-sm font-medium flex items-center justify-center p-2 rounded-md ${status.bgColor} ${status.textColor}`}
        >
          <div className={`w-2 h-2 rounded-full mr-2 ${status.dotColor}`}></div>
          {status.text}

          {statusConexao !== "offline" && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-6 px-2"
              onClick={sincronizarDados}
              disabled={sincronizando}
            >
              {sincronizando ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
              <span className="ml-1 text-xs">Sincronizar</span>
            </Button>
          )}
        </div>

        {/* Last sync time */}
        <div className="text-xs text-center text-muted-foreground flex items-center justify-center mt-2">
          <Clock className="h-3 w-3 mr-1" />
          Última sincronização: {formatLastSync()}
        </div>
      </div>

      {/* Confirmation dialog for registering */}
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

      {/* Confirmation dialog for undoing */}
      <Dialog open={confirmarDesfazer} onOpenChange={setConfirmarDesfazer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desfazer último registro</DialogTitle>
            <DialogDescription>
              {historico.length > 0 ? (
                <>
                  {historico[0].trocaCilindro ? (
                    <span>
                      Você está prestes a desfazer a troca de cilindro feita por{" "}
                      {historico[0].operador || "operador não identificado"}.
                    </span>
                  ) : (
                    <>
                      Você está prestes a desfazer o registro de {historico[0].quantidade}g feito por{" "}
                      {historico[0].operador || "operador não identificado"}.
                      {historico[0].valorFinalRodada && (
                        <div className="mt-2 flex items-center text-amber-600">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          <span>Este registro completou uma rodada. Desfazê-lo reverterá para a rodada anterior.</span>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <span>Não há registros para desfazer.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarDesfazer(false)} disabled={processando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={desfazerUltimoRegistro}
              disabled={historico.length === 0 || processando}
            >
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Desfazer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for cylinder change */}
      <Dialog open={confirmarTrocaCilindro} onOpenChange={setConfirmarTrocaCilindro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar troca de cilindro</DialogTitle>
            <DialogDescription>
              O cilindro realmente foi trocado?
              <div className="mt-2 flex items-center text-amber-600">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <span>Esta ação encerrará a rodada atual e iniciará uma nova com acumulado zero.</span>
              </div>
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
                "Confirmar Troca"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
