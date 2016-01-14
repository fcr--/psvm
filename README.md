# psvm

This project will be a simple pseudo-postscript interpreter for several
architectures.

## MS-DOS.

The MS-DOS being written in C is still on its pre-infancy, so please bear to
wait so that I can implement the remaining pieces.

Some features:
  - I'll try to make it run on i8086 tiny (or maybe small) model leaving some 
    ram for the apps after the parser, interpreter, garbage collector and 
    runtime.
  - Use a mark & sweep garbage collector with an object compactor (memory 
    defragmententer).

## javascript.

- Current state: parser and threaded execute are working and complete-ish, but
  only about a dozen commands are implemented.
- The code clearly shows that I'm still a beginner with javascript.
