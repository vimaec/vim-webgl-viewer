/**
 * @module vim-loader
 */

/**
 * Returns a value from cache or queue up existing request or start a new requests
 */
export class RemoteValue<T> {
  label: string
  private _value: T
  private _getter: () => Promise<T>
  private _request: Promise<T>

  constructor (getter: () => Promise<T>, label?: string) {
    this._getter = getter
    this.label = label
  }

  /**
   * Returns a value from cache or queue up existing request or start a new requests
   */
  get (): Promise<T> {
    if (this._value) {
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
      this._request = null
      return this._value
    })
    return this._request
  }
}
