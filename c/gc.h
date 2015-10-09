#ifndef GC_H
#define GC_H

/****** Initialization ******
 * The root object is that that never gets garbage collected. It must contain
 * direct or indirect references to all the objects in the system that MUST
 * not get garbage collected. Also, the root object MUST be allocated by this
 * same GC.
 *
 * As this is a compactor garbage collector, addresses of objects may change,
 * and in that (rare) case the root object address changes, then the compactor
 * will reflect that change modifying the address pointed by the
 * root_object_reference.
 *
 * Since obviously no object is allocated before gc_init is called,
 * root_object_reference MUST be the valid address of a NULL initialized
 * pointer:
 *   void * root_object = NULL;
 *   ...
 *   gc_init(..., ..., &root_object);
 *   gc_register_type(..., ...); ...
 *   ...
 *   // allocating root_object: (the root object MUST be a valid gc object)
 *   root_object = gc_alloc(..., ...);
 *   ...
 */
void gc_init(void * totalmem, unsigned int totalsize,
    void ** root_object_reference);

void * gc_alloc(char tag, unsigned int size);

#define GC_RUN_FULLGC (-1)
void gc_run(int steps);

void gc_compact(void);

void gc_info(unsigned int * totalram,
    unsigned int * freeram,
    unsigned int * object_count,
    unsigned int * cfc); // contiguous free chunks
// fragmentation index: (cfc - 1.0)/object_count:
//     1.0 -> (worst case) totally fragmented
//     0.0 -> (ideal) no fragmentation

struct gc_type_vtable {
  // must NOT use scratchpad:
  void (*visit_references)(
      void * obj,
      void (*fn)(void * ref, void * privdata),
      void * privdata);
};
void gc_register_type(char tag, struct gc_type_vtable * vtable);
#endif
