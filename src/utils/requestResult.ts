
export class SuccessResult<T> {
  result: T

  constructor (result: T) {
    this.result = result
  }

  isSuccess (): true {
    return true
  }

  isError (): false {
    return false
  }
}

export class ErrorResult {
  error: string

  constructor (error: string) {
    this.error = error
  }

  isSuccess (): false {
    return false
  }

  isError (): this is ErrorResult {
    return true
  }
}

export type RequestResult<T> = SuccessResult<T> | ErrorResult
