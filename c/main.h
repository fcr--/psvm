#ifndef MAIN_H
#define MAIN_H
#define SCRATCHPAD_SIZE 1024
#define SCRATCHPAD_MASK 0x3ff
extern void * scratchpad;
void print(char * str);
void printhex(int num);
#endif
