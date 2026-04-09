import React, { useState } from 'react'
import { useUploadAlgorithm } from '../api/hooks'

export default function UploadAlgorithm() {
  const [file, setFile] = useState<File | null>(null)
  const upload = useUploadAlgorithm()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (file) upload.mutate(file)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-2">Upload Algorithm</h1>
        <form onSubmit={onSubmit} className="bg-white p-4 rounded-md shadow-sm space-y-3">
          <input
            type="file"
            accept=".jar"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!file || upload.isPending}
              className="text-sm text-white bg-primary px-3 py-1.5 rounded-md disabled:opacity-60"
            >
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </button>
            {upload.isError && (
              <span className="text-sm text-red-700 max-w-xl">
                Upload failed{upload.error && ': '}
                {(() => {
                  const err: any = upload.error
                  return (
                    err?.response?.data?.message ||
                    err?.response?.data?.error ||
                    err?.response?.data ||
                    (err as Error)?.message ||
                    ''
                  )
                })()}
                {/** Provide hints for common 400 causes */}
                <ul className="mt-1 list-disc list-inside text-xs text-red-800 space-y-0.5">
                  <li>File must be a valid algorithm JAR (Bootstrap-Class in Manifest).</li>
                  <li>Ensure the JAR name doesn’t conflict with an existing algorithm unless intentionally updated.</li>
                  <li>Backend must be running and /api/algorithms/store reachable.</li>
                </ul>
              </span>
            )}
            {upload.isSuccess && <span className="text-sm text-green-700">Uploaded</span>}
          </div>
        </form>
      </div>

    </div>
  )
}
