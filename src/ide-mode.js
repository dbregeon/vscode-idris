let formatter    = require('./wire/formatter')
let parser       = require('./wire/parser')
let EventEmitter = require('events').EventEmitter
let spawn        = require('child_process').spawn

class IdrisIdeMode extends EventEmitter {
  constructor() {
    super()
    this.process = null
    this.buffer = ''
    this.idrisBuffers = 0
    this.compilerOptions = {}
  }

  start(compilerOptions) {
    var options, p, parameters, pathToIdris, pkgs
    if ((this.process == null) || this.process.killed) {
      pathToIdris = 'idris' 
      pkgs = compilerOptions.pkgs && compilerOptions.pkgs.length ? (p = compilerOptions.pkgs.map(function(p) {
        return ["-p", p]
      }), [].concat.apply([], p)) : []
      options = compilerOptions.options ? compilerOptions.options.split(' ') : []
      parameters = ['--ide-mode'].concat(pkgs, options)
      options = compilerOptions.src ? {
        cwd: compilerOptions.src
      } : {}
      this.process = spawn(pathToIdris, parameters, options)
      this.process.on('error', this.error)
      this.process.on('exit', this.exited)
      this.process.on('close', this.exited)
      this.process.on('disconnect', this.exited)
      return this.process.stdout.setEncoding('utf8').on('data', this.stdout)
    }
  }

  setCompilerOptions(options) {
    return this.compilerOptions(options)
  }

  send(cmd) {
    return this.process.stdin.write(formatter.serialize(cmd))
  }

  stop() {
    var ref
    return (ref = this.process) != null ? ref.kill() : void 0
  }

  error(error) {
    var e
    e = error.code === 'ENOENT' ? {
      short: "Couldn't find idris executable",
      long: "Couldn't find idris executable at \"" + error.path + "\""
    } : {
      short: error.code,
      long: error.message
    }
    return atom.notifications.addError(e.short, {
      detail: e.long
    })
  }

  exited(code, signal) {
    var long, short
    if (signal === "SIGTERM") {
      short = "The idris compiler was closed"
      long = "You stopped the compiler"
      return atom.notifications.addInfo(short, {
        detail: long
      })
    } else {
      short = "The idris compiler was closed or crashed"
      long = signal ? "It was closed with the signal: " + signal : "It (probably) crashed with the error code: " + code
      return atom.notifications.addError(short, {
        detail: long
      })
    }
  }

  running() {
    return !!this.process
  }

  stdout(data) {
    var cmd, len, obj, results
    this.buffer += data
    results = []
    while (this.buffer.length > 6) {
      this.buffer = this.buffer.trimLeft().replace(/\r\n/g, "\n")
      len = parseInt(this.buffer.substr(0, 6), 16)
      if (this.buffer.length >= 6 + len) {
        cmd = this.buffer.substr(6, len).trim()
        this.buffer = this.buffer.substr(6 + len)
        obj = parse.parse(cmd.trim())
        results.push(this.emit('message', obj))
      } else {
        break
      }
    }
    return results
  }
}

module.exports = IdrisIdeMode