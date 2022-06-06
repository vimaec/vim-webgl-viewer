/**
 * @module vim-loader
 */

/**
 * Returns a value from cache or queue up existing request or start a new requests
 */
export class RemoteValue<T> {
  label: string
  private _getter: () => Promise<T>
  private _value: T | undefined
  private _request: Promise<T> | undefined

  constructor (getter: () => Promise<T>, label?: string) {
    this._getter = getter
    this.label = label ?? ''
  }

  /**
   * Returns a value from cache or queue up existing request or start a new requests
   */
  get (): Promise<T> {
    if (this._value !== undefined) {
      // console.log(this.label + ' returning cached value ')
      return Promise.resolve(this._value)
    }

    if (this._request) {
      // console.log(this.label + ' returning existing request')
      return this._request
    }

    // console.log(this.label + ' creating new request')
    this._request = this._getter().then((value) => {
      this._value = value
      this._request = undefined
      return this._value
    })
    return this._request
  }
}
