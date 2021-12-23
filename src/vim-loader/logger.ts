export class Logger {
  private name: string

  constructor (name: string) {
    this.name = name
  }

  logStart () {
    console.time(this.name)
  }

  log (msg: string) {
    console.timeLog(this.name, msg)
  }

  logEnd () {
    console.timeEnd(this.name)
  }

  timeAction<T> (task: string, call: () => T): T {
    console.log(this.name + ' Started ' + task)
    const time = this.name + ' Ended ' + task
    console.time(time)
    const result = call()
    console.timeEnd(time)
    return result
  }
}
