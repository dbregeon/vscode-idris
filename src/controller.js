let vscode    = require('vscode')
let cp        = require('child_process')
let formatter = require('./wire/formatter')
let parser    = require('./wire/parser')

let outputChannel = vscode.window.createOutputChannel('Idris')
let diagnosticCollection = vscode.languages.createDiagnosticCollection()

let getCommands = () => {
  return [
    ['idris.typecheck', typecheckFile]
  ]
}

var buffer = ''
var requestId = 0
var warnings = {}

let getUID = () => {
  return ++requestId
}

let handleCommand = (cmd, cwd) => {
  if (cmd.length > 0) {
    let op = cmd[0]
    let params = cmd.slice(1, cmd.length - 1)
    let id = cmd[cmd.length - 1]
    switch (op) {
      case ':return':
      let ret = params[0]
      if (ret[0] === ':ok') {
        let okparams = ret[1]
        outputChannel.clear()
        outputChannel.show()
        outputChannel.append("Idris: File loaded successfull")
      } else {
        let message = ret[1]
        let warning = warnings[id]
        outputChannel.clear()
        outputChannel.show()
        diagnosticCollection.clear()
        let buf = []
        let diagnostics = []
        let len = warning.length
        buf.push("Errors (" + len + ")")
        for (i = 0; i < len; i++) {
          let w = warning[i]
          let file = w[0].replace("./", cwd + "/")
          let line = w[1][0]
          let char = w[1][1]
          let message = w[3]
          buf.push(file + ":" + line + ":" + char)
          buf.push(message)
          buf.push("")
          let range = new vscode.Range(line - 1, char - 1, line, 0)
          let diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error)
          diagnostics.push([vscode.Uri.file(file), [diagnostic]])
        }
        outputChannel.appendLine(buf.join('\n'))
        diagnosticCollection.set(diagnostics)
      }
      break
      case ':write-string':
      let msg = params[0]
      break
      case ':warning':
      warning = params[0]
      warnings[id].push(warning)
      break
      case ':set-prompt':
      break
    }
  }
}

let stdout = (data, cwd) => {
  buffer += data
  while (buffer.length > 6) {
    buffer = buffer.trimLeft().replace(/\r\n/g, "\n")
    let len = parseInt(buffer.substr(0, 6), 16)
    if (buffer.length >= 6 + len) {
      let cmd = buffer.substr(6, len).trim()
      buffer = buffer.substr(6 + len)
      let obj = parser.parse(cmd.trim())
      handleCommand(obj, cwd)
    } else {
      break
    }
  }
}

let typecheckFile = () => {
  let uri = vscode.window.activeTextEditor.document.uri.path
  let cwd = vscode.workspace.rootPath + "/src"

  let uid = getUID()
  warnings[uid] = []
  let cmd = [[':load-file', uri], 1]

  new Promise(function (resolve, reject) {
    let options = vscode.workspace.rootPath ? { cwd } : {}
    let childProcess = cp.spawn('idris', ['--ide-mode'], options)

    childProcess.on('error', (error) => {
      vscode.window.showErrorMessage('Cannot find Idris.')
      resolve()
    })

    if (childProcess.pid) {
      childProcess.stdout.setEncoding('utf8').on('data', (data) => {
        stdout(data, cwd)
        resolve()
      })
    }

    childProcess.stdin.write(formatter.serialize(cmd))
    outputChannel.clear()
    outputChannel.show()
    outputChannel.append("loading...")
  }).then(function () {
    //vscode.window.showInformationMessage("Idris: File loaded successfully")
  }).catch(function () {
    //vscode.window.showErrorMessage("Idris Errors")
  })
}

module.exports = {
  getCommands,
  diagnosticCollection
}