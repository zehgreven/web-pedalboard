export function readModel(file: File): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e: ProgressEvent<FileReader>) => {
      const content = e.target?.result
      resolve(typeof content === 'string' ? content : null)
    }

    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${file.name}`))
    }

    reader.onabort = () => {
      reject(new Error(`File read aborted: ${file.name}`))
    }

    reader.readAsText(file)
  })
}
