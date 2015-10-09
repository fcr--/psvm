
if (Map === undefined) {
  alert("Old browsers without Map are not *yet* supported.\n" +
      "When I have time I'm gonna finish the implementation, " +
      "please bear with me.")
  Map = function() {
    this.__array = []
    this.size = 0
    this.initialize()
  }

  Map.prototype.delete = function(key) {
    var bucket = this.findBucketOrUndefined(key)
    if (bucket === undefined) return false
    delete this.__array[bucket]
    this.size--
    this.fixCollisionsFrom((bucket + 1) % this.__array.length)
  }

  Map.prototype.findBucketOrUndefined = function(key) {
    // return the index associated to the key.
    var sz = this.__array.length
    var bucket = Map.Hash(key) % sz
    while ((a = this.__array[bucket] !== undefined) && (a.key !== key)) {
      bucket = (bucket + 1) % sz
    }
    return a && bucket
  }

  Map.prototype.fixCollisionsFrom = function(bucket) {
    var assoc
    while ((assoc = this.__array[bucket]) !== undefined) {
      delete this.__array[bucket]
      size--
      this.set(assoc.key, assoc.value)
      bucket = (bucket + 1) % this.__array.length
    }
  }

  Map.prototype.initialize = function(capacity) {
    this.__array = []
    this.__array.length = (capacity === undefined ? 5 : capacity)
    this.size = 0
  }

  Map.prototype.get = function(key) {
    var bucket = this.findBucketOrUndefined(key)
    if (bucket !== undefined) return this.__array[bucket].value
  }

  Map.prototype.has = function(key) {
    return this.findBucketOrUndefined(key) !== undefined
  }

  Map.prototype.set = function(key, value) {
    this.resizeIfNeeded(true) // up=true
    var a, bucket = Map.hash(key) % this.__array.length
    // in case of a collision advance a bucket
    while ((a = this.__array[bucket]) !== undefined && a.key !== key) {
      bucket = (bucket + 1) % as
    }
    this.__array[bucket] = {key: key, value: value}
    if (a === undefined) this.size++
    return this
  }

  Map.prototype.resizeIfNeeded = function(up) {
    var newSize, newArray = []
    if (up) {
      var upperLimit = (this.__array.length * 5 / 4) | 0 // 80%
      if (this.size <= upperLimit) return this

      newSize = this.__array.length * 2 + 5
    } else {
      var lowerLimit = ((this.__array.length - 5) / 4) | 0
      if (this.size >= lowerLimit) return this

      newSize = ((this.__array.length - 5) / 2) | 0
    }
    newArray.length = newSize

    // put existing elements in the new positions:
    for (var i = 0; i < this.__array.length; i++) {
      var assoc = this.__array[i]
      if (assoc !== undefined) {
	bucket = Map.hash(assoc.key) % newSize
	// in case of a collision advance a bucket:
	while (newArray[bucket] !== undefined) bucket = (bucket + 1) % newSize
	newArray[bucket] = assoc
      }
    }
    this.__array = newArray
    return this
  }

  (function() {
    var lastStorageId = 1000000;

    Map.hash = function(object) {
      if (object === null) return 0
      switch (typeof object) {
	case "undefined": return 1
	case "boolean": return object?2:3
	case "object":
	  return object.__MapId || (object.__MapId = ++lastStorageId) || 4
	case "function":
	  return object.__MapId || (object.__MapId = ++lastStorageId) || 5
	case "string":
	  var hash = 0, len = object.length;
	  for (var i = 0; i < len; i++) {
	    hash = (((hash << 5) - hash) + object.charCodeAt(i)) | 0;
	  }
	  return hash;
	case "symbol": return Map.hash(object.toString())
	case "number": return Map.hash(object.toString())
	default: return 6
      }
    }
  }());
}
// types:
//   number: 42, -1, 3.14, 9.8e-1
//   Symbol: /foo /bar /a.b /Na-me /helloWorld /1+1
//   string: (hello world) (1*(2+4)+5) (foo\000bar\(a) (\\\n) (\)) <48656c6c6f>
//   array: [1 2 (foo)]
//   Map: <<a b>>
//   Mark: created by running mark
function Interp() {
  this.stack = []
  this.console = new DummyConsole()
  // names is a stack of dictionaries
  this.names = [new Map([
    ["add", function(interp) {
      if (interp.stack.length < 2) throw "add: /stackunderflow"
      var elem1 = interp.stack[interp.stack.length - 2]
      var elem2 = interp.stack[interp.stack.length - 1]
      if (typeof elem1 == "number" && typeof elem2 == "number") {
	interp.stack.push(interp.stack.pop() + interp.stack.pop())
      } else if (typeof elem1 == "string" && typeof elem2 == "string") {
	interp.stack.pop()
	interp.stack.pop()
	interp.stack.push(elem1 + elem2)
      } else {
	// TODO: add support for add on other types
	throw "copy: /unsupported"
      }
    }], ["begin", function(interp) {
      interp.names.push(new Map())
    }], ["clear", function(interp) {
      interp.stack.length = 0
    }], ["copy", function(interp) {
      if (interp.stack.length < 1) throw "copy: /stackunderflow"
      var last = interp.stack[interp.stack.length - 1]
      if (typeof last == "number") {
	if (last < 0) throw "copy: /rangecheck"
	if (interp.stack.length - 1 < last) throw "copy: /stackunderflow"
	interp.stack.pop()
	for (var i = 0; i < last; i++) {
	  interp.stack.push(interp.stack[interp.stack.length - last])
	}
      } else {
	// TODO: PLRM pdf page 562
	throw "copy: /unsupported"
      }
    }], ["count", function(interp) {
      interp.stack.push(interp.stack.length)
    }], ["currentdict", function(interp) {
      interp.stack.push(interp.names[interp.names.length - 1])
    }], ["cvs", function(interp) {
      interp.stack.push(interp.stack.pop().toString())
    }], ["dup", function(interp) {
      if (interp.stack.length < 1) throw "dup: /stackunderflow"
      interp.stack.push(interp.stack[interp.stack.length - 1])
    }], ["end", function(interp) {
      if (interp.names.length < 2) throw "end: /dictstackunderflow"
      interp.names.pop()
    }], ["exch", function (interp) {
      if (interp.stack.length < 2) throw "exch: /stackunderflow"
      var x = interp.stack.pop()
      var y = interp.stack.pop()
      interp.stack.push(x)
      interp.stack.push(y)
    }], ["false", false],
    ["if", function (interp) { // cond proc if --
      if (interp.stack.length < 2) throw "if: /stackunderflow"
      if (typeof interp.stack[interp.stack.length - 2] != "boolean") throw "if: /typecheck"
      var proc = interp.stack.pop()
      var cond = interp.stack.pop()
      if (cond) interp.threadedStack.push(proc)
    }], ["index", function (interp) { // an .. a0 n index an .. a0 an
      if (interp.stack.length < 2) throw "index: /stackunderflow"
      n = interp.stack[interp.stack.length - 1]
      if (typeof n != "number" || (n|0) != n) throw "index: /typecheck"
      if (n < 0) throw "index: /rangecheck"
      if (interp.stack.length < n + 2) throw "index: /stackunderflow"
      interp.stack.pop()
      interp.stack.push(interp.stack[interp.stack.length - 1 - n])
    }], ["mark", Mark.instance],
    ["pop", function (interp) {
      if (interp.stack.length < 2) throw "pop: /stackunderflow"
      interp.stack.pop()
    }], ["repeat", function (interp) { // rep proc repeat --
      if (interp.stack.length < 2) throw "repeat: /stackunderflow"
      var rep = interp.stack[interp.stack.length - 2]
      if (typeof rep != "number" || (rep|0) != rep) throw "repeat: /typecheck"
      if (rep < 0) throw "repeat: /rangecheck"
      var proc = interp.stack.pop()
      interp.stack.pop()
      var cont = function (interp) {
	if (rep-- > 0) interp.threadedStack.push(cont)
	interp.threadedStack.push(proc)
      }
      if (rep-- > 0) cont(interp)
    }], ["true", true],
    ["=", function (interp) {
      if (interp.stack.length < 1) throw "=: /stackunderflow"
      interp.console.print(interp.stack.pop().toString() + "\n")
    }], ["==", function (interp) {
      if (interp.stack.length < 1) throw "==: /stackunderflow"
      interp.console.print(JSON.stringify(interp.stack.pop()) + "\n")
    }]])]
  // TODO: add remaining basic operators!
  this.threadedStack = []
}
Interp.spaces = " \f\n\r\t\v\u00A0\u2028\u2029"
Interp.endName = Interp.spaces + "[]{}<>/"
Interp.escapeChars = {n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "\n": ""}
Interp.prototype.constructor = Interp
Interp.prototype.resolve = function(name) {
  for (var i = this.names.length - 1; i >= 0; i--) {
    var res = this.names[i].get(name)
    if (res !== undefined) return res
  }
  throw "Resolving unknown symbol " + name
}
/**
 * Params is an object with the following keywords:
 *   obj: object to execute, if there was an execution in progress, then this
 *       object is executed in an inner stack frame, and when this obj
 *       finishes executing, it will continue to the previous one.
 *   steps: limit execution to a fixed number of steps, after that the same
 *       execution will be continued by just running execute again.
 */
Interp.prototype.execute = function(params) {
  if ('obj' in params) this.threadedStack.push(params.obj)
  var steps = ('steps' in params) ? params.steps : Infinity
  while (steps > 0) {
    var obj = this.threadedStack.pop()
    if (obj === undefined) return
    if (typeof obj == "function") {
      obj(this)
    } else if (typeof obj == "number" || typeof obj == "string" ||
	typeof obj == "boolean" || obj instanceof Map ||
	obj instanceof Mark || (obj instanceof Symbol && obj.reference)) {
      this.stack.push(obj)
    } else if (obj instanceof Array) {
      var contFunction = (function(obj, pos){
	var f = function(interp) {
	  var o = obj[pos]
	  if (obj.length > ++pos) interp.threadedStack.push(f)
	  if (o instanceof Array) {
	    interp.stack.push(o)
	  } else {
	    interp.threadedStack.push(o)
	  }
	}
	return f
      })(obj, 0)
      if (obj.length) this.threadedStack.push(contFunction)
    } else if (obj instanceof Symbol && !obj.reference) {
      this.threadedStack.push(this.resolve(obj.name))
    } else {
      throw "Executing unknown object: " + typeof obj
    }
    steps--
  }
}
Interp.prototype.require = function(method, url, callback) {
  var client = new XMLHttpRequest()
  var that = this
  client.open(method, url, true)
  callback = callback === undefined ? function(){} : callback
  client.onreadystatechange = function() {
    if (client.readyState == XMLHttpRequest.DONE) {
      if (client.responseText === null) {
	// XMLHttpRequest does not provide more information since it could
	// be a security breach.
	return callback('error', 'XMLHttpRequest error, ' +
	    'read the console log for more information')
      }
      var ex
      if (((client.status / 100) | 0) != 2) {
	ex = {
	  toString: function() { return ex.status + ': ' + ex.statusText },
	  status: client.status,
	  statusText: client.statusText
	}
	return callback('error', ex)
      }
      try {
	that.threadedStack.push(Interp.parse(client.responseText))
      } catch(exc) {
	ex = exc
      }
      callback(ex === undefined ? 'ok' : 'error', ex)
    }
  }
  client.overrideMimeType('text/plain; charset=UTF-8')
  client.send()
  return client
}
Interp.parse = function(text) {
  var res = [[]]
  for (var i = 0; i < text.length; i++) {
    var c = text.charAt(i)
    if (c == "%") {
      while (text.charAt(i) != "\n" && i < text.length) i++
    } else if (c == "(") { // open string
      var resString = [], parensCount = 1, escaped = false
      while (i < text.length && parensCount > 0) {
	c = text.charAt(i+1)
	if (!escaped && c=="\\") {
	  escaped = true
	} else if (!escaped && c=="(") {
	  parensCount++
	  resString.push(c)
	} else if (!escaped && c==")") {
	  parensCount--
	  if (parensCount > 0) resString.push(c)
	} else if (!escaped) {
	  resString.push(c)
	} else if ("0" <= c && c <= "7") {
	  var currentByte = c.charCodeAt(0) - 48
	  if (i+1 < text.length && "0" <= (c=text.charAt(++i)) && c <= "7")
	    currentByte = currentByte * 8 + c.charCodeAt(0) - 48
	  if (i+1 < text.length && "0" <= (c=text.charAt(++i)) && c <= "7")
	    currentByte = currentByte * 8 + c.charCodeAt(0) - 48
	} else {
	  resString.push((c in Interp.escapeChars)? Interp.escapeChars[c] : c)
	  escaped = false
	}
	i++
      }
      if (i >= text.length) {
	throw "Syntax error at " + i + ", unexpected EOF inside string"
      }
      res[res.length-1].push(resString.join(""))
    } else if (c == ")") { // syntax error
      throw "Syntax error at " + i + ", unexpected ) without open string"
    } else if (c == "/") { // begin symbol name reference
      var symbolName = []
      while (i+1 < text.length && Interp.endName.indexOf(c = text.charAt(i+1)) < 0) {
	symbolName.push(c)
	i++
      }
      res[res.length-1].push(new Symbol(symbolName.join(""), true))
    } else if (c == "{") { // begin block
      res.push([])
    } else if (c == "}") { // end block
      if (res.length < 2) throw "Syntax error at " + i + ", unexpected } outside outmost block"
      var d = res.pop()
      res[res.length-1].push(d)
    } else if (c == "<") { // begin dict or hexstring
      i++
      if (i < text.length && text.charAt(i) == "<") {
	res[res.length-1].push(new Symbol("<<", false))
      } else {
	var bytes = [], lastNib = 0, nib = 0, waitingHighNibble = true
	while (i < text.length && (c=text.charAt(i)) != ">") {
	  if ((nib="0123456789abcdef".indexOf(c.toLowerCase())) >= 0) {
	    if (waitingHighNibble) {
	      lastNib = nib * 16
	    } else {
	      bytes.push(String.fromCharCode(lastNib * 16 + nib))
	    }
	    waitingHighNibble = !waitingHighNibble
	  } else if (Interp.spaces.indexOf(c) < 0) {
	    throw "Syntax error at " + i + ", unexpected character inside hex string"
	  }
	  i++
	}
	if (!waitingHighNibble) bytes.push(String.fromCharCode(lastNib * 16))
	res[res.length-1].push(bytes.join(""))
	if (c != ">") {
	  throw "Syntax error at " + i + ", unexpected EOF inside hex string"
	}
      }
    } else if (c == "[" || c == "]") { // begin or end array
      res[res.length-1].push(new Symbol(c, false))
    } else if (c == ">") { // syntax error unless next is end dict
      if (i + 1 < text.length && text.charAt(i+1) == ">") {
	res[res.length-1].push(new Symbol(">>", false))
	i++
      } else {
	throw "Syntax error at " + i + ", unexpected >"
      }
    } else if (Interp.spaces.indexOf(c) >= 0) {
    } else { // symbol or number
      var symbolName = []
      while (i < text.length && Interp.endName.indexOf(c = text.charAt(i)) < 0) {
	symbolName.push(c)
	i++
      }
      i--
      symbolName = symbolName.join("")
      if (/^[+-]?(([0-9]+\.[0-9]*|[0-9]*\.[0-9]+)(e[+-]?[0-9]+)?|0x[0-9a-fA-F]+|[1-9][0-9]*)$/.test(symbolName)) {
	res[res.length-1].push(
	    (symbolName.indexOf('.')>=0 ? parseFloat : parseInt)(symbolName))
      } else if (/^[+-]?0[0-9]*$/.test(symbolName)) { // octal support
	res[res.length-1].push(parseInt(symbolName, 8))
      } else {
	res[res.length-1].push(new Symbol(symbolName, false))
      }
    }
  }
  if (res.length > 1) throw "Syntax error at " + i + ", unexpected EOF inside block"
  return res.pop()
}

function Symbol(name, reference) {
  this.name = name
  this.reference = (reference === undefined ? true : reference)
}
Symbol.prototype = {
  constructor: Symbol,
  toString: function() {
    return "[Symbol " + (this.reference ? "reference " : "") + this.name + "]"
  }
}

function Mark() {}
Mark.instance = new Mark()

function DummyConsole() {
}
DummyConsole.prototype = {
  constructor: DummyConsole,
  print: function(str) {},
  clear: function() {},
  setAttr: function(sgr) {}
}

function BasicConsole(domElement) {
  this.elem = domElement
  this.clear()
  this.setAttr(0)
}
BasicConsole.colors = [
  // normal colors (indexes 0~7)
  '#000000', //black
  '#b21818', //red
  '#18b218', //green
  '#b26818', //brown/dark yellow
  '#1818b2', //blue
  '#b218b2', //magenta
  '#18b2b2', //cyan
  '#b2b2b2', //gray
  // bright colors (indexes 8~15)
  '#686868', //darkgray
  '#ff5454', //bright red
  '#54ff54', //bright green
  '#ffff54', //yellow
  '#5454ff', //bright blue
  '#ff54ff', //bright magenta
  '#54ffff', //bright cyan
  '#ffffff' //white
]
BasicConsole.prototype = new DummyConsole()
BasicConsole.prototype.constructor = BasicConsole
BasicConsole.prototype.print = function(str) {
  var span = this.elem.lastChild
  var style = this.getCssAttr()
  if (!(span instanceof HTMLSpanElement) ||
      span.getAttribute('style') != style) {
    span = document.createElement('span')
    span.setAttribute('style', style)
    this.cssAttr = span.getAttribute('style') //store maybe normalized version
    this.elem.appendChild(span)
  }
  if (span.lastChild instanceof Text) {
    span.lastChild.appendData(str)
  } else {
    span.appendChild(document.createTextNode(str))
  }
}
BasicConsole.prototype.clear = function() {
  var last;
  while (last = this.elem.lastChild) this.elem.removeChild(last)
}
BasicConsole.prototype.setAttr = function(sgr) {
  delete this.cssAttr
  switch (sgr) {
    case 0: this.attrs = {bold: false, faint: false, italic: false,
      underlined: false, blink: false, inverse: false, invisible: false,
      foreground: 7, background: 0}; break
    case 1: this.attrs.bold = true; break
    case 2: this.attrs.faint = true; break
    case 3: this.attrs.italic = true; break
    case 4: this.attrs.underlined = true; break
    case 5: this.attrs.blink = true; break
    case 7: this.attrs.inverse = true; break
    case 8: this.attrs.invisible = true; break
    case 22: this.attrs.bold = this.attrs.faint = false; break
    case 23: this.attrs.italic = false; break
    case 24: this.attrs.underlined = false; break
    case 25: this.attrs.blink = false; break
    case 27: this.attrs.inverse = false; break
    case 28: this.attrs.invisible = false; break
    case 30: case 31: case 32: case 33: case 34: case 35: case 36: case 37:
      this.attrs.foreground = sgr-30; break
    case 39: this.attrs.foreground = 7; break
    case 40: case 41: case 42: case 43: case 44: case 45: case 46: case 47:
      this.attrs.background = BasicConsole.colors[sgr-40]; break
    case 49: this.attrs.ground = 0; break
  }

}
BasicConsole.prototype.getCssAttr = function() {
  if ('cssAttr' in this) return this.cssAttr
  attrList = []
  // faint & blink ignored
  if (this.attrs.bold) attrList.push('font-weight: bold')
  if (this.attrs.italic) attrList.push('font-style: italic')
  if (this.attrs.underlined) attrList.push('text-decoration: underline')
  if (this.attrs.invinsible) attrList.push('visibility: hidden')
  var fg = BasicConsole.colors[this.attrs.bold ? this.attrs.foreground + 7
					       : this.attrs.foreground]
  var bg = BasicConsole.colors[this.attrs.background]
  attrList.push('color: ' + (this.attrs.inverse ? bg : fg))
  attrList.push('background-color: ' + (this.attrs.inverse ? fg : bg))
  this.cssAttr = attrList.join("; ")
  return this.cssAttr
}

// TODO: Implement GraphicConsole using: http://stackoverflow.com/questions/4899799/whats-the-best-way-to-set-a-single-pixel-in-an-html5-canvas
