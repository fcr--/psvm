
if (this.Map === undefined) {
  /* This is a half-compatible pretty decent implementation of Map in native
   * javascript. It just provides enough support for this project.
   * @constructor
   * @struct
   */
  Map = function(kv) {
    /**
     * Hash table where key value entries are stored, or undefined on free
     * buckets.  The implementation uses a closed hash table using the next
     * free bucket (module this.size) in case of collisions.
     * @type {Array<undefined|{key, value}>}
     */
    this.__array = [];
    /** Count of non undefined elements in __array. @type {number} */
    this.size = 0;
    if (kv !== undefined) {
      // initialized to f^{-1}(kv.length) where f is the average of the
      // rehashing limit functions, so that it's not rehashed during
      // initialization, nor after a few average set & delete calls.
      //   f(x) = ( x*4/5 + (x-5)/2 ) / 2
      this.initialize((20 * kv.length + 25) / 13 | 0);
      for (var i = 0; i < kv.length; i++) {
        this.set(kv[i][0], kv[i][1]);
      }
    } else {
      this.initialize();
    }
  };

  /**
   * Deletes a key from the hash map.
   *
   * It was defined with brackets instead of dot method, because in ecmascript
   * version <5 identifiers can't use reserved keyword.
   *
   * @param {object} key Key to delete.
   * @return {boolean} True if the key was found and deleted, false otherwise.
   * @this
   */
  Map.prototype['delete'] = function(key) {
    var bucket = this.findBucketOrUndefined_(key);
    if (bucket === undefined) return false;
    delete this.__array[bucket];
    this.size--;
    this.fixCollisionsFrom((bucket + 1) % this.__array.length);
    return true;
  };

  /**
   * This function return the index associated to the key, or undefined if
   * it's not found
   * @param {object} key Key to look for.
   * @return {number} the index within the __array member array or undefined
   *    if it's not found
   * @private
   */
  Map.prototype.findBucketOrUndefined_ = function(key) {
    var sz = this.__array.length;
    var bucket = Map.hash(key) % sz;
    var a;
    while (((a = this.__array[bucket]) !== undefined) && (a.key !== key)) {
      bucket = (bucket + 1) % sz;
    }
    if (a) return bucket;
  };

  /**
   * Since collisions in a closed hash table span to the following buckets, it
   * may be tricky to remove an element without making a mess, aka: leaving
   * some entries unreachable.  However there's an easy way to ensure the table
   * integrity, and that is: when an element at the bucket i is removed, rehash
   * all the entries from i+1 until undefined is found.  That's what this
   * function does.
   * @param {number} bucket index of bucket from where to start rehashing.
   * @private
   */
  Map.prototype.fixCollisionsFrom_ = function(bucket) {
    var assoc;
    while ((assoc = this.__array[bucket]) !== undefined) {
      delete this.__array[bucket];
      size--;
      this.set(assoc.key, assoc.value);
      bucket = (bucket + 1) % this.__array.length;
    }
  };

  /**
   * Frees the Map, and allocates memory for a new dictionary.
   * @param {number=} capacity initial size for the internal __array.
   */
  Map.prototype.initialize = function(capacity) {
    this.__array = [];
    this.__array.length = (capacity === undefined ? 5 : capacity);
    this.size = 0;
  };

  Map.prototype.get = function(key) {
    var bucket = this.findBucketOrUndefined_(key);
    if (bucket !== undefined) return this.__array[bucket].value;
  };

  Map.prototype.has = function(key) {
    return this.findBucketOrUndefined_(key) !== undefined;
  };

  Map.prototype.set = function(key, value) {
    this.resizeIfNeeded(true); // up=true
    var a, bucket = Map.hash(key) % this.__array.length;
    // in case of a collision advance a bucket
    while ((a = this.__array[bucket]) !== undefined && a.key !== key) {
      bucket = (bucket + 1) % this.__array.length;
    }
    this.__array[bucket] = {key: key, value: value};
    if (a === undefined) this.size++;
    return this;
  };

  Map.prototype.resizeIfNeeded = function(up) {
    var newSize, newArray = [];
    if (up) {
      var upperLimit = (this.__array.length * 4 / 5) | 0; // 80%
      if (this.size <= upperLimit) return this;

      newSize = this.__array.length * 2 + 5;
    } else {
      var lowerLimit = ((this.__array.length - 5) / 4) | 0;
      if (this.size >= lowerLimit) return this;

      newSize = ((this.__array.length - 5) / 2) | 0;
    }
    newArray.length = newSize;

    // put existing elements in the new positions:
    for (var i = 0; i < this.__array.length; i++) {
      var assoc = this.__array[i];
      if (assoc !== undefined) {
        bucket = Map.hash(assoc.key) % newSize;
        // in case of a collision advance a bucket:
        while (newArray[bucket] !== undefined) bucket = (bucket + 1) % newSize;
        newArray[bucket] = assoc;
      }
    }
    this.__array = newArray;
    return this;
  };

  var _ = function() {
    var lastStorageId = 1000000;

    Map.hash = function(object) {
      if (object === null) return 0;
      switch (typeof object) {
        case 'undefined': return 1;
        case 'boolean': return object ? 2 : 3;
        case 'object':
          return object.__MapId || (object.__MapId = ++lastStorageId) || 4;
        case 'function':
          return object.__MapId || (object.__MapId = ++lastStorageId) || 5;
        case 'string':
          var hash = 0, len = object.length;
          for (var i = 0; i < len; i++) {
            hash = (((hash << 5) - hash) + object.charCodeAt(i)) | 0;
          }
          return hash;
        case 'symbol': return Map.hash(object.toString());
        case 'number': return Map.hash(object.toString());
        default: return 6;
      }
    };
  }; _();
}
// types:
//   number: 42, -1, 3.14, 9.8e-1
//   Symbol: /foo /bar /a.b /Na-me /helloWorld /1+1
//   string: (hello world) (1*(2+4)+5) (foo\000bar\(a) (\\\n) (\)) <48656c6c6f>
//   array: [1 2 (foo)]
//   Map: <<a b>>
//   Mark: created by running mark
function Interp() {
  var stack = this.stack = [];
  stack.last = function() { return stack[stack.length - 1] };
  this.console = new DummyConsole();
  this.forcerefresh = false;
  // names is a stack of dictionaries
  this.names = [new Map([
    ['abs', function(interp) {
      if (interp.stack.length < 1) throw 'abs: /stackunderflow';
      if (typeof interp.stack.last() !== 'number') throw 'abs: /typecheck';
      interp.stack[interp.stack.length - 1] =
          Math.abs(interp.stack[interp.stack.length - 1]);
    }], ['add', function(interp) {
      if (interp.stack.length < 2) throw 'add: /stackunderflow';
      var elem1 = interp.stack[interp.stack.length - 2];
      var elem2 = interp.stack[interp.stack.length - 1];
      if (typeof elem1 == 'number' && typeof elem2 == 'number') {
        interp.stack.push(interp.stack.pop() + interp.stack.pop());
      } else if (typeof elem1 == 'string' && typeof elem2 == 'string') {
        interp.stack.pop();
        interp.stack.pop();
        interp.stack.push(elem1 + elem2);
      } else {
        // TODO: add support for add on other types
        throw 'add: /unsupported';
      }
    }], ['atan2', function(interp) {
      if (interp.stack.length < 2) throw 'atan2: /stackunderflow';
      if (typeof interp.stack[interp.stack.length - 2] !== 'number' ||
          typeof interp.stack.last() !== 'number') throw 'atan2: /typecheck';
      var den = interp.stack.pop();
      interp.stack[interp.stack.length - 1] = 180 / Math.PI *
          Math.atan2(interp.stack[interp.stack.length - 1], den);
    }], ['begin', function(interp) {
      if (interp.stack.length < 1) throw 'begin: /stackunderflow';
      if (!(interp.stack.last() instanceof Map)) throw 'begin: /typecheck';
      interp.names.push(interp.stack.pop());
    }], ['clear', function(interp) {
      interp.stack.length = 0;
    }], ['copy', function(interp) {
      if (interp.stack.length < 1) throw 'copy: /stackunderflow';
      var last = interp.stack.last();
      if (typeof last == 'number') {
        if (last < 0) throw 'copy: /rangecheck';
        if (interp.stack.length - 1 < last) throw 'copy: /stackunderflow';
        interp.stack.pop();
        for (var i = 0; i < last; i++) {
          interp.stack.push(interp.stack[interp.stack.length - last]);
        }
      } else {
        // TODO: PLRM pdf page 562
        throw 'copy: /unsupported';
      }
    }], ['count', function(interp) {
      interp.stack.push(interp.stack.length);
    }], ['currentdict', function(interp) {
      interp.stack.push(interp.names[interp.names.length - 1]);
    }], ['cvi', function(interp) {
      if (interp.stack.length < 1) throw 'cvi: /stackunderflow';
      var n = interp.stack.last();
      if (typeof n == 'string') {
        n = Interp.parseNumber(n);
        if (n === undefined) throw 'cvi: /typecheck';
      } else if (typeof n != 'number') {
        throw 'cvi: /typecheck';
      }
      interp.stack[interp.stack.length - 1] = n | 0;
    }], ['cvs', function(interp) {
      interp.stack.push(interp.stack.pop().toString());
    }], ['def', function(interp) {
      if (interp.stack.length < 2) throw 'def: /stackunderflow';
      var s = interp.stack[interp.stack.length - 2];
      if (!(s instanceof Symbol)) throw 'def: /typecheck';
      interp.names[interp.names.length - 1].set(s.name, interp.stack.pop());
      interp.stack.pop();
    }], ['dict', function(interp) {
      if (interp.stack.length < 1) throw 'dict: /stackunderflow';
      var n = interp.stack.last();
      if (typeof n != 'number' || (n | 0) != n) throw 'dict: /typecheck';
      if (n < 0) throw 'dict: /rangecheck';
      interp.stack.pop();
      var d = new Map();
      // n is ignored for native Map.
      if ('initialize' in d) d.initialize((n * 1.5) | 0);
      interp.stack.push(d);
    }], ['div', function(interp) {
      if (interp.stack.length < 2) throw 'div: /stackunderflow';
      var a = interp.stack[interp.stack.length - 2];
      var b = interp.stack[interp.stack.length - 1];
      if (typeof a != 'number' || typeof b != 'number') throw 'div: /typecheck';
      interp.stack.pop();
      interp.stack[interp.stack.length - 1] = a / b;
    }], ['dup', function(interp) {
      if (interp.stack.length < 1) throw 'dup: /stackunderflow';
      interp.stack.push(interp.stack.last());
    }], ['end', function(interp) {
      if (interp.names.length < 2) throw 'end: /dictstackunderflow';
      interp.names.pop();
    }], ['eq', function(interp) {
      if (interp.stack.length < 2) throw 'eq: /stackunderflow';
      var x = interp.stack.pop();
      interp.stack[interp.stack.length - 1] =
          (interp.stack[interp.stack.length - 1] == x);
    }], ['exch', function(interp) {
      if (interp.stack.length < 2) throw 'exch: /stackunderflow';
      var x = interp.stack.pop();
      var y = interp.stack.pop();
      interp.stack.push(x);
      interp.stack.push(y);
    }], ['exp', function(interp) {
      if (interp.stack.length < 2) throw 'exp: /stackunderflow';
      var a = interp.stack[interp.stack.length - 2];
      var b = interp.stack[interp.stack.length - 1];
      if (typeof a != 'number' || typeof b != 'number') throw 'exp: /typecheck';
      interp.stack.pop();
      interp.stack[interp.stack.length - 1] = Math.pow(a, b);
    }], ['false', false],
    ['for', function(interp) { // initial increment limit proc for --
      if (interp.stack.length < 4 ||
          typeof interp.stack[interp.stack.length - 2] !== 'number' ||
          typeof interp.stack[interp.stack.length - 3] !== 'number' ||
          typeof interp.stack[interp.stack.length - 4] !== 'number') {
        throw 'for: /typecheck';
      }
      var proc = interp.stack.pop();
      var limit = interp.stack.pop();
      var increment = interp.stack.pop();
      var initial = interp.stack.pop();
      var cont = function(interp) {
        interp.stack.push(initial);
        initial += increment;
        if (increment >= 0 && initial <= limit ||
            increment < 0 && initial >= limit) interp.threadedStack.push(cont);
        interp.threadedStack.push(proc);
      };
      if (increment >= 0 && initial <= limit ||
          increment < 0 && initial >= limit) cont(interp);
    }], ['get', function(interp) {
      if (interp.stack.length < 2) throw 'get: /stackunderflow';
      if (typeof interp.stack[interp.stack.length - 1] !== 'number') {
        throw 'get: /typecheck';
      }
      var num = interp.stack.pop();
      interp.stack[interp.stack.length - 1] =
          interp.stack[interp.stack.length - 1][num];
    }], ['grflush', function(interp) {
      interp.console.flush();
      interp.forcerefresh = true;
    }], ['grputpixel', function(interp) {
      if (interp.stack.length < 3 ||
          typeof interp.stack[interp.stack.length - 1] !== 'number' ||
          typeof interp.stack[interp.stack.length - 2] !== 'number' ||
          typeof interp.stack[interp.stack.length - 3] !== 'number') {
        throw 'grputpixel: /typecheck';
      }
      var y = interp.stack.pop();
      var x = interp.stack.pop();
      interp.console.putPixel(interp.stack.pop(), x, y);
    }], ['if', function(interp) { // cond proc if --
      if (interp.stack.length < 2) throw 'if: /stackunderflow';
      if (typeof interp.stack[interp.stack.length - 2] != 'boolean') {
        throw 'if: /typecheck';
      }
      var proc = interp.stack.pop();
      var cond = interp.stack.pop();
      if (cond) interp.threadedStack.push(proc);
    }], ['ifelse', function(interp) { // cond proctrue procfalse if --
      if (interp.stack.length < 3) throw 'ifelse: /stackunderflow';
      if (typeof interp.stack[interp.stack.length - 3] != 'boolean') {
        throw 'ifelse: /typecheck';
      }
      var procfalse = interp.stack.pop();
      var proctrue = interp.stack.pop();
      interp.threadedStack.push(interp.stack.pop() ? proctrue : procfalse);
    }], ['index', function(interp) { // an .. a0 n index an .. a0 an
      if (interp.stack.length < 2) throw 'index: /stackunderflow';
      n = interp.stack.last();
      if (typeof n != 'number' || (n | 0) != n) throw 'index: /typecheck';
      if (n < 0) throw 'index: /rangecheck';
      if (interp.stack.length < n + 2) throw 'index: /stackunderflow';
      interp.stack.pop();
      interp.stack.push(interp.stack[interp.stack.length - 1 - n]);
    }], ['length', function(interp) {
      if (interp.stack.length < 1) throw 'length: /stackunderflow';
      interp.stack[interp.stack.length - 1] =
          interp.stack[interp.stack.length - 1].length;
    }], ['lt', function(interp) {
      if (interp.stack.length < 2) throw 'lt: /stackunderflow';
      var x = interp.stack.pop();
      interp.stack[interp.stack.length - 1] =
          (interp.stack[interp.stack.length - 1] < x);
    }], ['mark', Mark.instance],
    ['pop', function(interp) {
      if (interp.stack.length < 2) throw 'pop: /stackunderflow';
      interp.stack.pop();
    }], ['mod', function(interp) {
      if (interp.stack.length < 2) throw 'mod: /stackunderflow';
      var a = interp.stack[interp.stack.length - 2];
      var b = interp.stack[interp.stack.length - 1];
      if (typeof a != 'number' || typeof b != 'number') throw 'mod: /typecheck';
      interp.stack.pop();
      interp.stack[interp.stack.length - 1] = a % b;
    }], ['mul', function(interp) {
      if (interp.stack.length < 2) throw 'mul: /stackunderflow';
      var a = interp.stack[interp.stack.length - 2];
      var b = interp.stack[interp.stack.length - 1];
      if (typeof a != 'number' || typeof b != 'number') throw 'mul: /typecheck';
      interp.stack.pop();
      interp.stack[interp.stack.length - 1] = a * b;
    }], ['rand', function(interp) {
      // pushes a random floating point in range 0 inc, 1 exc.
      interp.stack.push(Math.random());
    }], ['repeat', function(interp) { // rep proc repeat --
      if (interp.stack.length < 2) throw 'repeat: /stackunderflow';
      var rep = interp.stack[interp.stack.length - 2];
      if (typeof rep != 'number' || (rep | 0) != rep) {
        throw 'repeat: /typecheck';
      }
      if (rep < 0) throw 'repeat: /rangecheck';
      var proc = interp.stack.pop();
      interp.stack.pop();
      var cont = function(interp) {
        if (rep-- > 0) interp.threadedStack.push(cont);
        interp.threadedStack.push(proc);
      };
      if (rep-- > 0) cont(interp);
    }], ['sqrt', function(interp) {
      if (interp.stack.length < 1) throw 'sqrt: /stackunderflow';
      if (typeof interp.stack.last() !== 'number') throw 'sqrt: /typecheck';
      interp.stack[interp.stack.length - 1] =
          Math.sqrt(interp.stack[interp.stack.length - 1]);
    }], ['sub', function(interp) {
      if (interp.stack.length < 2) throw 'sub: /stackunderflow';
      var a = interp.stack[interp.stack.length - 2];
      var b = interp.stack[interp.stack.length - 1];
      if (typeof a != 'number' || typeof b != 'number') throw 'sub: /typecheck';
      interp.stack.pop();
      interp.stack[interp.stack.length - 1] = a - b;
    }], ['true', true],
    ['=', function(interp) {
      if (interp.stack.length < 1) throw '=: /stackunderflow';
      interp.console.print(interp.stack.pop().toString() + '\n');
    }], ['==', function(interp) {
      if (interp.stack.length < 1) throw '==: /stackunderflow';
      interp.console.print(JSON.stringify(interp.stack.pop()) + '\n');
    }], ['[', Mark.instance], [']', function(interp) {
      var idx = interp.stack.lastIndexOf(Mark.instance);
      if (idx < 0) throw ']: /unmatchedmark';
      var newarr = interp.stack.splice(idx, interp.stack.length - idx);
      newarr.splice(0, 1);
      interp.stack.push(newarr);
    }]])];
  // TODO: add remaining basic operators!
  this.threadedStack = [];
}
Interp.parseNumber = function(text) {
  if (/^[+-]?([0-9]+\.[0-9]*|[0-9]*\.[0-9]+)(e[+-]?[0-9]+)?$/.test(text)) {
    return parseFloat(text);
  } else if (/^[+-]?(0x[0-9a-fA-F]+|[1-9][0-9]*)$/.test(text)) {
    return parseInt(text);
  } else if (/^[+-]?0[0-9]*$/.test(text)) { // octal support
    return parseInt(text, 8);
  }
};
Interp.spaces = ' \f\n\r\t\v\u00A0\u2028\u2029';
Interp.endName = Interp.spaces + '[]{}<>()/';
Interp.escapeChars = {n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\n': ''};
Interp.prototype.constructor = Interp;
Interp.prototype.resolve = function(name) {
  for (var i = this.names.length - 1; i >= 0; i--) {
    var res = this.names[i].get(name);
    if (res !== undefined) return res;
  }
  throw 'Resolving unknown symbol ' + name;
};

/**
 * Executes a Postscript object in the current interpreter instance.
 *
 * Unless specified, this function blocks until all threaded execution stack is
 * empty, in other words, until there isn't anything else to be executed.
 * However if the params.continueasync is true, then execute may return before
 * it has completed the execution.
 *
 * @param {{obj, steps: number}} params is an object with the following
 * keywords:
 *   obj: object to execute, if there was an execution in progress, then this
 *       object is executed in an inner stack frame, and when this obj
 *       finishes executing, it will continue to the previous one.
 *   steps: limit execution to a fixed number of steps, after that the same
 *       execution will be continued by just running execute again.
 * @return {*}
 */
Interp.prototype.execute = function(params) {
  if ('obj' in params) this.threadedStack.push(params.obj);
  var steps = (params.steps !== undefined) ? params.steps : Infinity;
  while (steps > 0 && !(params.continueasync && this.forcerefresh)) {
    if (this.threadedStack.length === 0) return;
    var obj = this.threadedStack.pop();
    if (obj === null || obj === undefined) {
      alert("something's gone really bad");
    }
    if (typeof obj == 'function') {
      obj(this);
    } else if (typeof obj == 'number' || typeof obj == 'string' ||
        typeof obj == 'boolean' || obj instanceof Map ||
        obj instanceof Mark || (obj instanceof Symbol && obj.reference)) {
      this.stack.push(obj);
    } else if (obj instanceof Array) {
      var _ = function(obj, pos) {
        var f = function(interp) {
          var o = obj[pos];
          if (obj.length > ++pos) interp.threadedStack.push(f);
          if (o instanceof Array) {
            interp.stack.push(o);
          } else {
            interp.threadedStack.push(o);
          }
        };
        return f;
      };
      var contFunction = _(obj, 0);
      if (obj.length) this.threadedStack.push(contFunction);
    } else if (obj instanceof Symbol && !obj.reference) {
      this.threadedStack.push(this.resolve(obj.name));
    } else {
      throw 'Executing unknown object: ' + typeof obj;
    }
    steps--;
  }
  this.forcerefresh = false;
  if (params.continueasync) {
    if (!('timerid' in this)) {
      var interp = this;
      this.timerid = setTimeout(function() {
        delete interp['timerid'];
        interp.execute({steps: params.steps,
          continueasync: params.continueasync});
      }, 0);
    }
  }
};
Interp.prototype.require = function(method, url, args) {
  var client = new XMLHttpRequest();
  var that = this;
  client.open(method, url, true);
  args = args === undefined ? {} : args;
  callback = args.callback === undefined ? function() {} : args.callback;
  client.onreadystatechange = function() {
    if (client.readyState == 4) {
      if (client.responseText === null) {
        // XMLHttpRequest does not provide more information since it could
        // be a security breach.
        return callback('error', 'XMLHttpRequest error, ' +
            'read the console log for more information');
      }
      var ex;
      if (((client.status / 100) | 0) != 2) {
        ex = {
          toString: function() { return ex.status + ': ' + ex.statusText },
          status: client.status,
          statusText: client.statusText
        };
        return callback('error', ex);
      }
      try {
        if (args.literal) {
          that.threadedStack.push(client.responseText);
        } else {
          that.threadedStack.push(Interp.parse(client.responseText));
        }
      } catch (exc) {
        ex = exc;
      }
      callback(ex === undefined ? 'ok' : 'error', ex);
    }
  };
  client.overrideMimeType(args.binary ?
      'text/plain; charset=x-user-defined' :
      'text/plain; charset=UTF-8');
  client.send(null);
  return client;
};
Interp.parse = function(text) {
  var res = [[]];
  res.last = function() { return res[res.length - 1]; };
  for (var i = 0; i < text.length; i++) {
    var c = text.charAt(i);
    if (c == '%') {
      while (text.charAt(i) != '\n' && i < text.length) i++;
    } else if (c == '(') { // open string
      var resString = [], parensCount = 1, escaped = false;
      while (i < text.length && parensCount > 0) {
        c = text.charAt(i + 1);
        if (!escaped && c == '\\') {
          escaped = true;
        } else if (!escaped && c == '(') {
          parensCount++;
          resString.push(c);
        } else if (!escaped && c == ')') {
          parensCount--;
          if (parensCount > 0) resString.push(c);
        } else if (!escaped) {
          resString.push(c);
        } else if ('0' <= c && c <= '7') {
          var currentByte = c.charCodeAt(0) - 48;
          if (i + 1 < text.length && '0' <= (c = text.charAt(++i)) && c <= '7')
            currentByte = currentByte * 8 + c.charCodeAt(0) - 48;
          if (i + 1 < text.length && '0' <= (c = text.charAt(++i)) && c <= '7')
            currentByte = currentByte * 8 + c.charCodeAt(0) - 48;
        } else {
          resString.push((c in Interp.escapeChars) ? Interp.escapeChars[c] : c);
          escaped = false;
        }
        i++;
      }
      if (i >= text.length) {
        throw 'Syntax error at ' + i + ', unexpected EOF inside string';
      }
      res.last().push(resString.join(''));
    } else if (c == ')') { // syntax error
      throw 'Syntax error at ' + i + ', unexpected ) without open string';
    } else if (c == '/') { // begin symbol name reference
      var symbolName = [];
      while (i + 1 < text.length &&
          Interp.endName.indexOf(c = text.charAt(i + 1)) < 0) {
        symbolName.push(c);
        i++;
      }
      res.last().push(new Symbol(symbolName.join(''), true));
    } else if (c == '{') { // begin block
      res.push([]);
    } else if (c == '}') { // end block
      if (res.length < 2) {
        throw 'Syntax error at ' + i + ', unexpected } outside outmost block';
      }
      var d = res.pop();
      res.last().push(d);
    } else if (c == '<') { // begin dict or hexstring
      i++;
      if (i < text.length && text.charAt(i) == '<') {
        res.last().push(new Symbol('<<', false));
      } else {
        var bytes = [], lastNib = 0, nib = 0, waitingHighNibble = true;
        while (i < text.length && (c = text.charAt(i)) != '>') {
          if ((nib = '0123456789abcdef'.indexOf(c.toLowerCase())) >= 0) {
            if (waitingHighNibble) {
              lastNib = nib * 16;
            } else {
              bytes.push(String.fromCharCode(lastNib * 16 + nib));
            }
            waitingHighNibble = !waitingHighNibble;
          } else if (Interp.spaces.indexOf(c) < 0) {
            throw 'Syntax error at ' + i + ', unexpected character inside ' +
                'hex string';
          }
          i++;
        }
        if (!waitingHighNibble) bytes.push(String.fromCharCode(lastNib * 16));
        res.last().push(bytes.join(''));
        if (c != '>') {
          throw 'Syntax error at ' + i + ', unexpected EOF inside hex string';
        }
      }
    } else if (c == '[' || c == ']') { // begin or end array
      res.last().push(new Symbol(c, false));
    } else if (c == '>') { // syntax error unless next is end dict
      if (i + 1 < text.length && text.charAt(i + 1) == '>') {
        res.last().push(new Symbol('>>', false));
        i++;
      } else {
        throw 'Syntax error at ' + i + ', unexpected >';
      }
    } else if (Interp.spaces.indexOf(c) >= 0) {
    } else { // symbol or number
      var symbolName = [];
      while (i < text.length &&
          Interp.endName.indexOf(c = text.charAt(i)) < 0) {
        symbolName.push(c);
        i++;
      }
      i--;
      symbolName = symbolName.join('');
      var d = Interp.parseNumber(symbolName);
      res.last().push(d !== undefined ? d : new Symbol(symbolName, false));
    }
  }
  if (res.length > 1) {
    throw 'Syntax error at ' + i + ', unexpected EOF inside block';
  }
  return res.pop();
};

function Symbol(name, reference) {
  this.name = name;
  this.reference = (reference === undefined ? true : reference);
}
Symbol.prototype = {
  constructor: Symbol,
  toString: function() {
    return '[Symbol ' + (this.reference ? 'reference ' : '') + this.name + ']';
  }
};

function Mark() {}
Mark.instance = new Mark();

function DummyConsole() {
}
DummyConsole.prototype = {
  constructor: DummyConsole,
  print: function(str) {},
  clear: function() {},
  setAttr: function(sgr) {}
};

function BasicConsole(domElement) {
  this.elem = domElement;
  this.clear();
  this.setAttr(0);
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
];
BasicConsole.prototype = new DummyConsole();
BasicConsole.prototype.constructor = BasicConsole;
if (typeof Text === 'undefined') {
  // hack for Konqueror support:
  Text = document.createTextNode('').__proto__.constructor;
}
BasicConsole.prototype.print = function(str) {
  var span = this.elem.lastChild;
  var style = this.getCssAttr_();
  if (span === null || span.tagName != 'SPAN' ||
      span.getAttribute('style') != style) {
    span = document.createElement('span');
    span.setAttribute('style', style);
    this.cssAttr = span.getAttribute('style'); //store maybe normalized version
    this.elem.appendChild(span);
  }
  if (span.lastChild instanceof Text) {
    span.lastChild.appendData(str);
  } else {
    span.appendChild(document.createTextNode(str));
  }
};
BasicConsole.prototype.clear = function() {
  var last;
  while (last = this.elem.lastChild) this.elem.removeChild(last);
};
BasicConsole.prototype.setAttr = function(sgr) {
  delete this.cssAttr;
  switch (sgr) {
    case 0: this.attrs = {bold: false, faint: false, italic: false,
      underlined: false, blink: false, inverse: false, invisible: false,
      foreground: 7, background: 0}; break;
    case 1: this.attrs.bold = true; break;
    case 2: this.attrs.faint = true; break;
    case 3: this.attrs.italic = true; break;
    case 4: this.attrs.underlined = true; break;
    case 5: this.attrs.blink = true; break;
    case 7: this.attrs.inverse = true; break;
    case 8: this.attrs.invisible = true; break;
    case 22: this.attrs.bold = this.attrs.faint = false; break;
    case 23: this.attrs.italic = false; break;
    case 24: this.attrs.underlined = false; break;
    case 25: this.attrs.blink = false; break;
    case 27: this.attrs.inverse = false; break;
    case 28: this.attrs.invisible = false; break;
    case 30: case 31: case 32: case 33: case 34: case 35: case 36: case 37:
      this.attrs.foreground = sgr - 30; break;
    case 39: this.attrs.foreground = 7; break;
    case 40: case 41: case 42: case 43: case 44: case 45: case 46: case 47:
      this.attrs.background = BasicConsole.colors[sgr - 40]; break;
    case 49: this.attrs.ground = 0; break;
  }
};
BasicConsole.prototype.getCssAttr_ = function() {
  if ('cssAttr' in this) return this.cssAttr;
  attrList = [];
  // faint & blink ignored
  if (this.attrs.bold) attrList.push('font-weight: bold');
  if (this.attrs.italic) attrList.push('font-style: italic');
  if (this.attrs.underlined) attrList.push('text-decoration: underline');
  if (this.attrs.invinsible) attrList.push('visibility: hidden');
  var fg = BasicConsole.colors[this.attrs.bold ?
      this.attrs.foreground + 7 :
      this.attrs.foreground];
  var bg = BasicConsole.colors[this.attrs.background];
  attrList.push('color: ' + (this.attrs.inverse ? bg : fg));
  attrList.push('background-color: ' + (this.attrs.inverse ? fg : bg));
  this.cssAttr = attrList.join('; ');
  return this.cssAttr;
};

function PsImage() {
}

function CompiledImage(string) {
  if (string.substr(0, 5) !== 'R4I\u001a\u00ff') throw 'Invalid image header.';
  var w = this.w = (string.charCodeAt(5) << 4) | (string.charCodeAt(6) >> 4);
  var h = this.h = ((string.charCodeAt(6) & 0xf) << 8) | string.charCodeAt(7);
  var buffer = this.buffer = new Uint8Array(((w + 1) / 2 | 0) * h);
  var bindex = 0, cfcount = 0, cflags = 0;
  for (var idx = 8; idx < string.length; idx++) {
    if (cfcount == 0) {
      cflags = string.charCodeAt(idx) | (string.charCodeAt(idx + 1) << 8);
      idx++;
      cfcount = 16;
      continue;
    }
    if ((cflags & 1) == 0) { //uncompressed
      buffer[bindex++] = string.charCodeAt(idx);
    } else { //compressed
      var tmp = string.charCodeAt(idx) | (string.charCodeAt(idx + 1) << 8);
      idx++;
      var pos = bindex - (tmp >> 4) - 1;
      for (var count = 3 + (tmp & 0xf); count > 0; count--) {
        buffer[bindex++] = buffer[pos++];
      }
    }
    cflags >>= 1;
    cfcount--;
  }
}
CompiledImage.prototype = PsImage;

GraphicConsole.colors = [
  [0xff, 0xff, 0xff], // 0: white (change findRgb if you change this value)
  [0xff, 0xff, 0x00], // 1: yellow
  [0xff, 0x66, 0x00], // 2: orange
  [0xdd, 0x00, 0x00], // 3: red
  [0xff, 0x00, 0x99], // 4: magenta
  [0x33, 0x00, 0x99], // 5: purple
  [0x00, 0x00, 0xcc], // 6: blue
  [0x00, 0x99, 0xff], // 7: cyan
  [0x00, 0xaa, 0x00], // 8: green
  [0x00, 0x66, 0x00], // 9: dark green
  [0x66, 0x33, 0x00], // 10: brown
  [0x99, 0x66, 0x33], // 11: tan
  [0xbb, 0xbb, 0xbb], // 12: light gray
  [0x88, 0x88, 0x88], // 13: gray
  [0x44, 0x44, 0x44], // 14: dark gray
  [0x00, 0x00, 0x00]  // 15: black
];
function GraphicConsole(params) {
  this.params = params;
  // delegation for textConsole methods:
  ['print', 'clear', 'setAttr'].forEach(function(methodname) {
    var method = params.textConsole[methodname];
    this[methodname] = function() {
      return method.apply(params.textConsole, arguments);
    };
  });
  this.canvasElemCtx = params.canvasElem.getContext('2d');
  this.canvasElemCtx.setTransform(2, 0, 0, 2, 0, 0);
  this.canvasElemCtx.imageSmoothingEnabled = false;
  this.canvasElemCtx.mozImageSmoothingEnabled = false;
  this.canvasElemCtx.webkitImageSmoothingEnabled = false;
  this.newCanvas = document.createElement('canvas');
  this.newCanvas.setAttribute('width', 320);
  this.newCanvas.setAttribute('height', 200);
  this.newContext = this.newCanvas.getContext('2d');
  this.imageData = this.newContext.createImageData(320, 200);
  var data = this.imageData.data;
  for (var i = 3; i < 256000; i += 4) {
    data[i] = 255; // opaque
  }
}
GraphicConsole.prototype = new DummyConsole();
GraphicConsole.prototype.constructor = GraphicConsole;
GraphicConsole.prototype.setColor = function(colorindex) {
  this.source = GraphicConsole.colors[colorindex];
};
GraphicConsole.prototype.findRgb = function(r, g, b) {
  var min = 0, minDistance = 765 - r - g - b; // assume color 0 is white
  for (var i = 1; i < GraphicConsole.colors.length; i--) {
    var c = GraphicConsole.colors[i];
    var dist = (c[0] - r) * (c[0] - r) +
        (c[1] - g) * (c[1] - g) +
        (c[2] - b) * (c[2] - b);
    if (dist == 0) return i;
    if (dist < minDistance) {
      min = i;
      minDistance = dist;
    }
  }
  return min;
};
GraphicConsole.prototype.getPixel = function(x, y) {
  var i = (y * 320 + x) * 4;
  return this.findRgb(data[i + 0], data[i + 1], data[i + 2]);
};
GraphicConsole.prototype.putPixel = function(color, x, y) {
  var i = (y * 320 + x) * 4;
  var data = this.imageData.data;
  c = GraphicConsole.colors[color];
  data[i] = c[0];
  data[i + 1] = c[1];
  data[i + 2] = c[2];
};
GraphicConsole.prototype.putRect = function(color, x, y, w, h) {
  var i = (((y | 0) * 320 + (x | 0)) * 4) | 0;
  var data = this.imageData.data;
  c = GraphicConsole.colors[color];
  var r = c[0] | 0, g = c[1] | 0, b = c[2] | 0;
  w = (w * 4) | 0;
  h = h | 0;
  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x += 4) {
      i[x] = r;
      i[x + 1] = g;
      i[x + 2] = b;
    }
    i = (i + 320 * 4) | 0;
  }
};
GraphicConsole.prototype.flush = function() {
  this.newContext.putImageData(this.imageData, 0, 0);
  this.canvasElemCtx.drawImage(this.newCanvas, 0, 0);
};

// vim: et
