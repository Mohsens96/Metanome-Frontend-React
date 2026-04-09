import React, { useRef } from 'react'

export default function FileUploader({ onUpload }: { onUpload: (files: File[]) => void }) {
  const ref = useRef<HTMLInputElement | null>(null)
  return (
    <div className="border-dashed border-2 border-gray-200 rounded-md p-6 text-center">
      <p className="text-sm text-muted">Drag and drop CSV file(s) here or click to select</p>
      <div className="mt-3">
        <button
          className="btn-primary"
          onClick={() => ref.current?.click()}
        >
          Choose file
        </button>
        <input
          ref={ref}
          type="file"
          accept=".csv, text/csv"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || [])
            if (files.length > 0) {
              onUpload(files)
              // Allow selecting the same file again by clearing value
              if (ref.current) ref.current.value = ''
            }
          }}
        />
      </div>
    </div>
  )
}
