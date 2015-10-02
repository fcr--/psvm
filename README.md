# psvm

This project will be a simple pseudo-postscript interpreter for MS-DOS. It's
still on its infancy, so please bare to wait so that I can implement the
remaining pieces.

Some features:
  - I'll try to make it run on i8086 tiny (or maybe small) model leaving some 
    ram for the apps after the parser, interpreter, garbage collector and 
    runtime.
  - Use a mark & sweep garbage collector with an object compactor (memory 
    defragmententer).
