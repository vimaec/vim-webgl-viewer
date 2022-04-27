/**
 * @module vim-loader
 */

import { Range } from './bfast'

/**
 * Represents the state of a single web request
 */
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

/**
 * Represents a collection of webrequests
 * Will only send update signal at most every delay
 * Provides convenient aggregation of metrics.
 */
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

  /**
   * callback on update, called at most every delay time.
   */
  onUpdate: (self: RequestLogger) => void

  constructor (source: string) {
    this.source = source
  }

  /**
   * Returns the sum of .loaded across all requests
   */
  get loaded () {
    let result = 0
    this.all.forEach((request) => {
      result += request.loaded
    })
    return result
  }

  /**
   * Returns the sum of .total across all requests
   */
  get total () {
    let result = 0
    this.all.forEach((request) => {
      result += request.total
    })
    return result
  }

  /**
   * Starts tracking a new web request
   */
  start (field: string) {
    this.all.set(field, new Request(field))
    this.signal()
  }

  /**
   * Update an existing web request
   */
  update (field: string, progress: ProgressEvent) {
    const r = this.all.get(field)
    if (r.status !== 'active') return
    r.loaded = progress.loaded
    r.total = progress.total
    r.lengthComputable = progress.lengthComputable
    this.signal()
  }

  /**
   * Notify a webrequest of failure
   */
  fail (field: string) {
    console.log(`${field} failed`)
    this.all.get(field).status = 'failed'
    this.signal()
  }

  /**
   * Notify a webrequest of success
   */
  end (field: string) {
    console.log(`${field} completed`)
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

/**
 * Wrapper to provide tracking for all webrequests via request logger.
 */
export class RemoteBuffer {
  url: string
  logger: RequestLogger
  queue: [XMLHttpRequest, string][] = []

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
    }
    const msg = range
      ? `${label} : [${range.start}, ${range.end}] of ${this.url}`
      : `${label} of ${this.url}`

    this.enqueue(xhr, msg)

    return new Promise<ArrayBuffer>((resolve, reject) => {
      this.logger.start(label)
      xhr.onprogress = (e) => {
        this.logger.update(label, e)
      }
      xhr.onload = () => {
        this.logger.end(label)
        resolve(xhr.response)
        this.next()
      }
      xhr.onerror = (_) => {
        this.logger.fail(label)
        resolve(undefined)
        this.next()
      }
    })
  }

  private enqueue (xhr: XMLHttpRequest, msg: string) {
    this.queue.push([xhr, msg])
    if (this.queue.length === 1) {
      console.log('Starting ' + msg)
      xhr.send()
    } else {
      console.log('Queuing ' + msg)
    }
  }

  private next () {
    this.queue.shift()
    if (this.queue.length > 0) {
      const [request, m] = this.queue[0]
      console.log('Starting ' + m)
      request.send()
    }
  }
}
