function assertEquals(f) {
  try {
    var items = f()
    var s0 = JSON.stringify(items[0])
    for (var i = 1; i < items.length; i++) {
      var si = JSON.stringify(items[i])
      if (s0 != si) {
	return alert("assertion failed with item 0 being different " +
	    "that item " + i + ": " + s0 + " != " + si + "\nsource: " +
	    f.toSource())
      }
    }
  } catch(err) {
    alert("assertion failed: " + f.toSource() + "\nwith exception: " + err)
  }
}
assertEquals(function() {return [Interp.parse("hello world"), [
  new Symbol("hello", false), new Symbol("world", false)]]})
assertEquals(function() {return [Interp.parse("1 1 add"),
  [1, 1, new Symbol("add", false)]]})
assertEquals(function() {return [Interp.parse("(hello ) (world) add"),
  ["hello ", "world", new Symbol("add", false)]]})
assertEquals(function() {return [Interp.parse("(a string (with) parens)"),
  ["a string (with) parens"]]})
assertEquals(function() {return [Interp.parse("(and with\\na backslash)"),
  ["and with\na backslash"]]})
assertEquals(function() {return [Interp.parse("(and \\(escaped\\) parens)"),
  ["and (escaped) parens"]]})
assertEquals(function() {return [Interp.parse("[1 2 (3)]"),
  [new Symbol("[", false), 1, 2, "3", new Symbol("]", false)]]})
assertEquals(function() {return [Interp.parse("{1 2 (3)}"), [[1, 2, "3"]]]})
assertEquals(function() {return [Interp.parse("{1 {2} 3}"), [[1, [2], 3]]]})
assertEquals(function() {return [Interp.parse("(1){2}{3}"), ["1", [2], [3]]]})
assertEquals(function() {return [Interp.parse("(all)/人間{are}[created]/="),
  ["all", new Symbol("人間", true), [new Symbol("are", false)],
    new Symbol("[", false), new Symbol("created", false),
    new Symbol("]", false), new Symbol("=", true)]]})
assertEquals(function() {return [Interp.parse("(1){2 }mark/[ 3]clear"),
  ["1", [2], new Symbol("mark", false), new Symbol("", true),
    new Symbol("[", false), 3, new Symbol("]", false),
    new Symbol("clear", false)]]})
