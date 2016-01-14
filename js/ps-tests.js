var _ = function(){

var assertEquals = function(f) {
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

var assertException = function(f) {
  try {
    var res = f()
    alert("assertion failed: " + f.toSource() +
	"\nexpected exception but got: " + res)
  } catch(ex) {}
}

/****************\
*  PARSER TESTS  *
\****************/

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

/************************\
*  BASIC COMMANDS TESTS  *
\************************/
var run = function(psCode) {
  var interp = new Interp()
  interp.execute({obj: Interp.parse(psCode)})
  return interp.stack
}

assertEquals(function(){return [run("1 1.99 3"), [1, 1.99, 3]]})
assertEquals(function(){return [run("1 1 add"), [2]]})
assertEquals(function(){return [run("(a) (b) add"), ["ab"]]})
assertEquals(function(){return [run("1 2 clear 3"), [3]]})
assertEquals(function(){return [run("1 2 3 2 copy 4"), [1, 2, 3, 2, 3, 4]]})
assertEquals(function(){return [run("42 (t) count"), [42, "t", 2]]})
assertEquals(function(){return [run("-3.1 cvi(-4.7)cvi 7 cvi"), [-3, -4, 7]]})
assertEquals(function(){return [run("-3.1 cvs 0x2a cvs"), ["-3.1", "42"]]})
assertEquals(function(){return [run("(a) cvs"), ["a"]]})
assertEquals(function(){return [run("1 2 dup 3"), [1, 2, 2, 3]]})
assertEquals(function(){return [run("1 2 div"), [0.5]]})
assertEquals(function(){return [run("1 2 3 exch 4"), [1, 3, 2, 4]]})
assertEquals(function(){return [run("2 8 exp"), [256]]})
assertEquals(function(){return [run("false"), [false]]})
assertEquals(function(){return [run("4 5 6 7 2 index"), [4, 5, 6, 7, 5]]})
assertEquals(function(){return [run("mark"), [Mark.instance]]})
assertEquals(function(){return [run("0 {fail} repeat"), []]})
assertEquals(function(){return [run("1 8 {dup add} repeat"), [256]]})
assertEquals(function(){return [run("2 8 sub"), [-6]]})
assertEquals(function(){return [run("true"), [true]]})
assertEquals(function(){return [run("1 0 -1{}for 100 1 1 3 {add} for"), [106]]})
assertEquals(function(){return [run("1 -1.5 -3 {} for"), [1, -0.5, -2]]})

assertEquals(function(){return [run(
      "/arctansteps { 3 dict begin % x steps arctansteps res\n" +
      "  exch /x exch def /p 1 def 0 exch {" +
      "    x p exp p div" +
      "    x p 2 add exp p 2 add div sub add" +
      "    /p p 4 add def" +
      "  } repeat " +
      "end } def " +
      "1 5 div 3 arctansteps 16 mul  1 239 div 3 arctansteps 4 mul sub " +
      "100000 mul cvi"), [314159]]})

}; _()
