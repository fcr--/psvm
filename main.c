#define __MINI_MALLOC__
#include <malloc.h>
#include <stdio.h>
#include "main.h"
#include "gc.h"

void print(char * str);

void printhex(int num) {
  int i;
  char buffer[5];
  static const char HEXCHARS[17] = "0123456789ABCDEF";
  buffer[4] = '$';
  for (i = 0; i < 4; i++) {
    buffer[i] = HEXCHARS[(num >> (12 - i*4)) & 0xf];
  }
  print(buffer);
}

void print(char * str) {
  char * s2 = str;
  while (*s2) s2++;
  *s2 = '$';
  bdos(9,  (int)str, 0x24);
  *s2 = 0;
}

void * scratchpad;

int main(void) {
  /* allocate ram: */ {
    unsigned int gcmemsize = 0;
    void * gcmemory = sbrk(0);
    scratchpad = sbrk(SCRATCHPAD_SIZE);
    // remaining ram goes to garbage collector
    while ((int)sbrk(0x100) != -1) gcmemsize += 0x100;
    gc_init(gcmemory, gcmemsize);
  }
  return 0;
}
