import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import DatasetsList from './pages/DatasetsList'
import DatasetDetails from './pages/DatasetDetails'
import UploadDataset from './pages/UploadDataset'
import RunsList from './pages/RunsList'
import RunProfile from './pages/RunProfile'
import ResultsOverview from './pages/ResultsOverview'
import ExecutionResults from './pages/ExecutionResults'
import Algorithms from './pages/Algorithms'
import UploadAlgorithm from './pages/UploadAlgorithm'
import Engines from './pages/Engines'
import UploadEngine from './pages/UploadEngine'
import Demo from './pages/demo/Demo'
import About from './pages/About'
import DpqlConsole from './pages/DpqlConsole'
import DpqlHistory from './pages/DpqlHistory'
import DpqlRunDetails from './pages/DpqlRunDetails'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="datasets" element={<DatasetsList />} />
        <Route path="datasets/:id" element={<DatasetDetails />} />
        <Route path="upload" element={<UploadDataset />} />
        <Route path="runs" element={<RunsList />} />
        <Route path="runs/new" element={<RunProfile />} />
  <Route path="results/:id" element={<ResultsOverview />} />
  <Route path="results/execution/:id" element={<ExecutionResults />} />
        <Route path="algorithms" element={<Algorithms />} />
  <Route path="algorithms/upload" element={<UploadAlgorithm />} />
        <Route path="engines" element={<Engines />} />
        <Route path="engines/upload" element={<UploadEngine />} />
        <Route path="demo" element={<Demo />} />
        <Route path="about" element={<About />} />
        <Route path="dpql" element={<DpqlConsole />} />
        <Route path="dpql/history" element={<DpqlHistory />} />
        <Route path="dpql/history/:id" element={<DpqlRunDetails />} />
      </Route>
    </Routes>
  )
}
