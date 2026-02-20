import { useState, useCallback, useRef } from 'react'
import './App.css'

type UploadState = 'idle' | 'dragging' | 'ready' | 'processing'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = reject
  })
}

export default function App() {
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [image, setImage] = useState<{ file: File; url: string } | null>(null)
  const [svgOutput, setSvgOutput] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const acceptFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return { file, url }
    })
    setSvgOutput(null)
    setError(null)
    setUploadState('ready')
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setUploadState('dragging')
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setUploadState(image ? 'ready' : 'idle')
  }, [image])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) acceptFile(file)
  }, [acceptFile])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) acceptFile(file)
    e.target.value = ''
  }, [acceptFile])

  const handleProcess = useCallback(async () => {
    if (!image) return
    setUploadState('processing')
    setError(null)
    setSvgOutput(null)

    try {
      const imageData = await fileToBase64(image.file)
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData, mimeType: image.file.type }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed')
      }

      setSvgOutput(data.svg)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setUploadState('ready')
    }
  }, [image])

  const isProcessing = uploadState === 'processing'

  return (
    <div className="layout">
      <header className="header">
        <h1 className="header__title">Image Processor</h1>
        <p className="header__sub">Upload an image to get started</p>
      </header>

      <main className="main">
        {/* Drop Zone */}
        <div
          className={[
            'drop-zone',
            uploadState === 'dragging' && 'drop-zone--dragging',
            image && 'drop-zone--filled',
          ].filter(Boolean).join(' ')}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          aria-label="Upload image"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onFileChange}
          />

          {image ? (
            <div className="drop-zone__preview">
              <img src={image.url} alt="Uploaded preview" className="drop-zone__image" />
              <span className="drop-zone__replace">Click or drop to replace</span>
            </div>
          ) : (
            <div className="drop-zone__prompt">
              <UploadIcon />
              <span className="drop-zone__label">
                {uploadState === 'dragging' ? 'Release to upload' : 'Drop image here'}
              </span>
              <span className="drop-zone__sub">or click to browse</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          className={['btn-process', isProcessing && 'btn-process--loading'].filter(Boolean).join(' ')}
          onClick={handleProcess}
          disabled={!image || isProcessing}
        >
          {isProcessing ? (
            <>
              <SpinnerIcon />
              Processing…
            </>
          ) : (
            'Process Image'
          )}
        </button>

        {/* Error message */}
        {error && <p className="error-msg">{error}</p>}

        {/* SVG Output */}
        {svgOutput && (
          <div
            className="svg-output"
            aria-label="SVG output"
            aria-live="polite"
            dangerouslySetInnerHTML={{ __html: svgOutput }}
          />
        )}
      </main>
    </div>
  )
}

function UploadIcon() {
  return (
    <svg
      className="icon-upload"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      className="icon-spinner"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
