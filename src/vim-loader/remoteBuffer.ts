import { Range } from './bfast'

class Request {
  status: 'active' | 'completed' | 'failed' = 'active'
  field: string
  loaded: number = 0
  total: number = 0
  lengthComputable: boolean = true

  constructor (field: string) {
    this.field = field
  }
}

export interface IProgressLogs {
  get loaded(): number
  get total(): number
  get all(): Map<string, Request>
}

export class RequestLogger {
  source: string
  all: Map<string, Request> = new Map<string, Request>()
  lastUpdate: number
  delay: 500
  sleeping: boolean
  onUpdate: (self: RequestLogger) => void

  constructor (source: string) {
    this.source = source
  }

  get loaded () {
    let result = 0
    this.all.forEach((request) => {
      result += request.loaded
    })
    return result
  }

  get total () {
    let result = 0
    this.all.forEach((request) => {
      result += request.total
    })
    return result
  }

  start (field: string) {
    this.all.set(field, new Request(field))
    this.signal()
  }

  update (field: string, progress: ProgressEvent) {
    const r = this.all.get(field)
    if (r.status !== 'active') return
    r.loaded = progress.loaded
    r.total = progress.total
    r.lengthComputable = progress.lengthComputable
    this.signal()
  }

  fail (field: string) {
    this.all.get(field).status = 'failed'
    this.signal()
  }

  end (field: string) {
    this.all.get(field).status = 'completed'
    this.signal()
  }

  private signal () {
    if (this.sleeping) return
    this.sleeping = true
    setTimeout(() => (this.sleeping = false), this.delay)
    this.onUpdate?.(this)
  }
}

export class RemoteBuffer {
  url: string
  logger: RequestLogger

  constructor (url: string, logger: RequestLogger = new RequestLogger(url)) {
    this.url = url
    this.logger = logger
  }

  async http (range: Range, label: string) {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', this.url)
    xhr.responseType = 'arraybuffer'

    if (range) {
      xhr.setRequestHeader('Range', `bytes=${range.start}-${range.end - 1}`)
      console.log(`${label} : [${range.start}, ${range.start}] of ${this.url}`)
    } else {
      console.log(`${label} of ${this.url}`)
    }

    return new Promise<ArrayBuffer>((resolve, reject) => {
      xhr.send()
      this.logger.start(label)
      xhr.onprogress = (e) => {
        this.logger.update(label, e)
      }
      xhr.onload = () => {
        this.logger.end(label)
        resolve(xhr.response)
      }
      xhr.onerror = (_) => {
        this.logger.fail(label)
        resolve(undefined)
      }
    })
  }
}
