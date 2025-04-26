export type EntradaGas = {
  id: string
  quantidade: number
  acumulado: number
  rodada: number
  data: string
  operador: string // Novo campo para identificação do operador
  valorFinalRodada?: number
  trocaCilindro?: boolean
}

export type EstadoAplicacao = {
  acumulado: number
  rodada: number
  historico: EntradaGas[]
}
