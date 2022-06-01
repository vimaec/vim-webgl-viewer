/**
 * @module vim-loader
 */

import { Range } from './bfast'
import { RemoteValue } from './remoteValue'

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
  lastUpdate: number = 0
  delay: number = 500
  sleeping: boolean = false

  /**
   * callback on update, called at most every delay time.
   */
  onUpdate: ((self: RequestLogger) => void) | undefined = undefined

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
    if (!r) throw new Error('Updating missing download')
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
    console.error(`${field} failed`)
    const download = this.all.get(field)
    if (!download) throw new Error('Failing missing download')
    download.status = 'failed'
    this.signal()
  }

  /**
   * Notify a webrequest of success
   */
  end (field: string) {
    console.log(`${field} completed`)
    const download = this.all.get(field)
    if (!download) throw new Error('Failing missing download')
    download.status = 'completed'
    this.signal()
  }

  private signal () {
    if (this.sleeping) return
    this.sleeping = true
    setTimeout(() => (this.sleeping = false), this.delay)
    this.onUpdate?.(this)
  }
}

class RetryRequest {
  url: string
  range: string
  // eslint-disable-next-line no-undef
  responseType: XMLHttpRequestResponseType
  msg: string
  xhr: XMLHttpRequest

  constructor (
    url: string,
    range: string,
    // eslint-disable-next-line no-undef
    responseType: XMLHttpRequestResponseType
  ) {
    this.url = url
    this.range = range
    this.responseType = responseType
  }

  onLoad: (result: any) => void
  onError: () => void
  onProgress: (e: ProgressEvent<EventTarget>) => void

  send () {
    this.xhr?.abort()
    const xhr = new XMLHttpRequest()
    xhr.open('GET', this.url)
    xhr.responseType = this.responseType

    if (this.range) {
      xhr.setRequestHeader('Range', this.range)
    }

    xhr.onprogress = (e) => {
      this.onProgress?.(e)
    }
    xhr.onload = () => {
      this.onLoad?.(xhr.response)
    }
    xhr.onerror = (_) => {
      this.onError?.()
    }
    xhr.send()
    this.xhr = xhr
  }
}

/**
 * Wrapper to provide tracking for all webrequests via request logger.
 */
export class RemoteBuffer {
  url: string
  logger: RequestLogger
  queue: RetryRequest[] = []
  active: Set<RetryRequest> = new Set<RetryRequest>()
  maxConcurency: number = 10
  encoded: RemoteValue<boolean>

  constructor (url: string, logger: RequestLogger = new RequestLogger(url)) {
    this.url = url
    this.logger = logger

    this.encoded = new RemoteValue(() => this.requestEncoding())
  }

  private async requestEncoding () {
    const xhr = new XMLHttpRequest()
    xhr.open('HEAD', this.url)
    xhr.send()
    console.log(`Requesting header for ${this.url}`)

    const promise = new Promise<string>((resolve, reject) => {
      xhr.onload = (_) => {
        let encoding = null
        try {
          encoding = xhr.getResponseHeader('content-encoding')
        } catch (e) {
          console.error(e)
        }
        resolve(encoding)
      }
      xhr.onerror = (_) => resolve(null)
    })

    const encoding = await promise
    const encoded = !!encoding

    console.log(`Encoding for ${this.url} = ${encoding}`)
    if (encoded) {
      console.log(
        `Defaulting to download strategy for encoded content at ${this.url}`
      )
    }
    return encoded
  }

  async http (range: Range | undefined, label: string) {
    const useRange = range && !(await this.encoded.get())
    const rangeStr = useRange
      ? `bytes=${range.start}-${range.end - 1}`
      : undefined
    const request = new RetryRequest(this.url, rangeStr, 'arraybuffer')
    request.msg = useRange
      ? `${label} : [${range.start}, ${range.end}] of ${this.url}`
      : `${label} of ${this.url}`

    this.enqueue(request)
    return new Promise<ArrayBuffer | undefined>((resolve, reject) => {
      this.logger.start(label)

      request.onProgress = (e) => {
        this.logger.update(label, e)
      }
      request.onLoad = (result) => {
        this.logger.end(label)
        resolve(result)
        this.end(request)
      }
      request.onError = () => {
        this.logger.fail(label)
        this.retry(request)
      }
    })
  }

  private enqueue (xhr: RetryRequest) {
    this.queue.push(xhr)
    this.next()
  }

  private retry (xhr: RetryRequest) {
    this.active.delete(xhr)
    this.maxConcurency = Math.max(1, this.maxConcurency - 1)
    setTimeout(() => this.enqueue(xhr), 2000)
  }

  private end (xhr: RetryRequest) {
    this.active.delete(xhr)
    this.next()
  }

  private next () {
    if (this.queue.length === 0) {
      return
    }

    if (this.active.size >= this.maxConcurency) {
      return
    }

    const next = this.queue[0]
    this.queue.shift()
    this.active.add(next)
    next.send()
    console.log('Starting ' + next.msg)
  }
}
