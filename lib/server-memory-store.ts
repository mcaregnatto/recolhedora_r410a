// Armazenamento em memória no servidor
// Nota: Este armazenamento será resetado se o servidor for reiniciado
// ou se a função serverless for recriada

import type { EstadoAplicacao } from "./types"

// Variável global para armazenar os dados em memória
let memoryStore: EstadoAplicacao = {
  acumulado: 0,
  rodada: 1,
  historico: [],
  lastUpdated: new Date().toISOString(),
  timestamp: Date.now(),
}

export const serverMemoryStore = {
  // Obter dados da memória
  getData(): EstadoAplicacao {
    return { ...memoryStore }
  },

  // Atualizar dados na memória
  updateData(newData: EstadoAplicacao): EstadoAplicacao {
    // Verificar se os dados são mais recentes
    if (newData.timestamp && memoryStore.timestamp && newData.timestamp <= memoryStore.timestamp) {
      // Se os dados não forem mais recentes, não atualizar
      return memoryStore
    }

    // Atualizar dados
    memoryStore = {
      ...newData,
      lastUpdated: new Date().toISOString(),
      timestamp: newData.timestamp || Date.now(),
    }

    return { ...memoryStore }
  },
}
