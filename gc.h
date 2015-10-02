#ifndef GC_H
#define GC_H
void gc_init(void * totalmem, unsigned int totalsize);
void * gc_alloc(char tag, unsigned int size);
#define GC_RUN_FULLGC (-1)
void gc_run(int steps);
void gc_compact(void);
void gc_info(unsigned int * freeram, unsigned int * freeatend);
struct gc_type_vtable {
  // must NOT use scratchpad:
  void (*visit_references)(
      void * obj,
      void (*fn)(void * ref, void * privdata),
      void * privdata);
};
void gc_register_type(char tag, struct gc_type_vtable * vtable);
#endif
