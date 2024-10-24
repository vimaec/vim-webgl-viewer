export class DeferredPromise<T> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason: T | Error) => void

  initialCallStack: Error['stack']

  constructor (executor: ConstructorParameters<typeof Promise<T>>[0] = () => {}) {
    let resolver: (value: T | PromiseLike<T>) => void
    let rejector: (reason: T | Error) => void

    super((resolve, reject) => {
      resolver = resolve
      rejector = reject
      return executor(resolve, reject) // Promise magic: this line is unexplicably essential
    })

    this.resolve = resolver!
    this.reject = rejector!

    // store call stack for location where instance is created
    this.initialCallStack = Error().stack?.split('\n').slice(2).join('\n')
  }

  /** @throws error with amended call stack */
  rejectWithError (error: Error) {
    error.stack = [error.stack?.split('\n')[0], this.initialCallStack].join('\n')
    this.reject(error)
  }
}
