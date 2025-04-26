"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface IndicadorProgressoProps {
  valor: number
  maximo: number
  titulo: string
  subtitulo?: string
}

export function IndicadorProgresso({ valor, maximo, titulo, subtitulo }: IndicadorProgressoProps) {
  // Calcular a porcentagem sem limitar a 100%
  const porcentagem = (valor / maximo) * 100

  // Determinar a largura da barra (limitada a 100% para visualização)
  const larguraBarra = Math.min(porcentagem, 100)

  // Função para determinar a cor baseada na porcentagem
  const getProgressColor = () => {
    if (porcentagem < 30) return "bg-gradient-to-r from-green-500 to-green-300"
    if (porcentagem < 60) return "bg-gradient-to-r from-green-400 to-yellow-400"
    if (porcentagem < 80) return "bg-gradient-to-r from-yellow-400 to-orange-400"
    if (porcentagem < 100) return "bg-gradient-to-r from-orange-400 to-red-500"
    return "bg-gradient-to-r from-red-500 to-red-700" // Cor para valores acima de 100%
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{titulo}</CardTitle>
        {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{valor.toLocaleString("pt-BR")}g</span>
            <span className={`text-sm font-medium ${porcentagem > 100 ? "text-red-600" : "text-muted-foreground"}`}>
              {porcentagem.toFixed(1)}%{porcentagem > 100 && " (Limite excedido)"}
            </span>
          </div>

          <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor()} transition-all duration-500 ease-in-out ${
                porcentagem > 100 ? "animate-pulse" : ""
              }`}
              style={{ width: `${larguraBarra}%` }}
              aria-valuenow={valor}
              aria-valuemin={0}
              aria-valuemax={maximo}
              role="progressbar"
            ></div>
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0g</span>
            <span>2.500g</span>
            <span>5.000g</span>
            <span>7.500g</span>
            <span>10.000g</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
