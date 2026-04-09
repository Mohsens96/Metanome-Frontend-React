// Centralized endpoints. Update these if backend path constants change.
// All endpoints are relative to baseURL + '/api' configured in axios.ts

export const endpoints = {
  fileInputs: {
    // Use database-backed list for datasets page; available-input-files is used only for scanning resource folder
    list: '/file-inputs',
    available: '/file-inputs/available-input-files',
    get: (id: string | number) => `/file-inputs/get/${id}`,
    storeMultipart: '/file-inputs/store', // multipart upload
    storeJson: '/file-inputs/store',
    update: '/file-inputs/update',
    delete: (id: string | number) => `/file-inputs/delete/${id}`,
    getDirectoryFiles: '/file-inputs/get-directory-files',
    preview: (id: string | number, lines = 50) => `/file-inputs/preview/${id}/${lines}`,
  },
  tableInputs: {
    list: '/table-inputs',
    get: (id: string | number) => `/table-inputs/get/${id}`,
    store: '/table-inputs/store',
    update: '/table-inputs/update',
    delete: (id: string | number) => `/table-inputs/delete/${id}`,
  },
  algorithms: {
    list: '/algorithms',
    get: (id: string | number) => `/algorithms/get/${id}`,
    storeJson: '/algorithms/store',
    storeMultipart: '/algorithms/store',
    update: '/algorithms/update',
    delete: (id: string | number) => `/algorithms/delete/${id}`,
    removeWithFile: (id: string | number) => `/algorithms/remove-with-file/${id}`,
    removeAllWithFiles: `/algorithms/remove-all-with-files`,
    forFileInputs: '/algorithms/algorithms-for-file-inputs',
    availableFiles: '/algorithms/available-algorithm-files/',
    categories: {
      basicStats: '/algorithms/basic-statistics-algorithms/',
    },
  },
  engines: {
    list: '/engines',
    get: (id: string | number) => `/engines/get/${id}`,
    storeJson: '/engines/store',
    storeMultipart: '/engines/store',
    update: '/engines/update',
    delete: (id: string | number) => `/engines/delete/${id}`,
    removeWithFile: (id: string | number) => `/engines/remove-with-file/${id}`,
    parameters: (id: string | number) => `/engines/parameters/${id}`,
    parametersDefault: '/engines/parameters/default',
    availableFiles: '/engines/available-engine-files/',
  },
  executions: {
    list: '/executions',
    get: (id: string | number) => `/executions/get/${id}`,
    getByIdentifier: (identifier: string) => `/executions/by-identifier/${encodeURIComponent(identifier)}`,
    delete: (id: string | number) => `/executions/delete/${id}`,
    deleteAll: '/executions/delete-all',
    countResults: (executionId: string | number) => `/executions/count-results/${executionId}`,
  },
  algorithmExecution: {
    start: '/algorithm-execution',
    stop: (identifier: string) => `/algorithm-execution/stop/${identifier}`,
  },
  resultStore: {
    count: (type: string) => `/result-store/count/${encodeURIComponent(type)}`,
    getFromTo: (type: string, sortProperty: string, sortOrder: string, start: number, end: number) =>
      `/result-store/get-from-to/${encodeURIComponent(type)}/${encodeURIComponent(sortProperty)}/${sortOrder}/${start}/${end}`,
    loadExecution: (executionId: string | number, dataIndependent = false) =>
      `/result-store/load-execution/${executionId}/${dataIndependent}`,
    loadExecutionByIdentifier: (identifier: string, dataIndependent = false) =>
      `/result-store/load-execution/by-identifier/${encodeURIComponent(identifier)}/${dataIndependent}`,
    loadResults: (id: string | number, dataIndependent = false) => `/result-store/load-results/${id}/${dataIndependent}`,
  },
  parameters: {
    getForAlgorithm: (algorithmFileName: string) => `/parameter/${algorithmFileName}`,
    authorsDescription: (algorithmFileName: string) => `/parameter/${algorithmFileName}/authors-description`,
  },
  databaseConnections: {
    list: '/database-connections',
    get: (id: string | number) => `/database-connections/get/${id}`,
    store: '/database-connections/store',
    update: '/database-connections/update',
    delete: (id: string | number) => `/database-connections/delete/${id}`,
  },
  dpql: {
    execute: '/dpql/execute',
    expand: '/dpql/expand',
    results: (id: string) => `/dpql/results/${id}`,
    runs: '/dpql/runs',
    run: (id: string) => `/dpql/runs/${id}`,
    deleteRun: (id: string) => `/dpql/runs/${id}`,
    runStatus: (id: string) => `/dpql/runs/${id}/status`,
    cancelRun: (id: string) => `/dpql/runs/${id}/cancel`,
    normalizedTablePage: (id: string, tableId: number, offset: number, limit: number, search?: string) =>
      `/dpql/runs/${id}/normalized-table/${tableId}?offset=${offset}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    tablePage: (id: string, tableId: number, offset: number, limit: number, search?: string) => 
      `/dpql/results/${id}/table/${tableId}?offset=${offset}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    tableExportCsv: (id: string, tableId: number, search?: string) =>
      `/dpql/results/${id}/table/${tableId}/export${search ? `?search=${encodeURIComponent(search)}` : ''}`,
  },
}

// NOTE: If any endpoint is ambiguous, update here and the types/adapters accordingly.
