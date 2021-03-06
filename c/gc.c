#include <stddef.h>
#include <assert.h>

#include "main.h"
#include "gc.h"

/**
 * This code is beautifully hardcoded to 16 bit pointers. If you want to port
 * it to "newer" (more bloated) architectures, feel free to do so; as you'll
 * probably need to change everything.
 *
 * The GC memory is just a concatenation of chunks with the following form:
 *   -> 16 bits header (that's why we use unsigned int everywhere).
 *   -> variable length data.
 * Each header has the following bits:
 *   -> 2 bits: gray and black bits for mark and sweep garbage collection.
 *              free blocks are represented as having only the black bit on.
 *      -> 0=white, 0x4000=free, 0x8000=gray, 0xc000=black.
 *   -> 3 bits: type of object.
 *   -> 11 bits: represents the chunk data length 0..4094 bytes. The less
 *               significant bit is always 0, and that's why it's not stored.
 */

#define GC_STATE_INIT 0
#define GC_STATE_INCOMPLETE 1
static int state = GC_STATE_INIT;
static void ** root_object_reference;
static void * memstart;
static unsigned int memsize;
static unsigned int usedram;
static unsigned int * first_free_chunk;
static struct gc_type_vtable * vtables[8];

#define gc_next_chunk(ptr) \
  (void*)((unsigned int*)(ptr) + (0x7ff & *(unsigned int*)(ptr)) + 1)

/**
 * @precondition free_chunk must point to a valid free chunk
 */
void gc_normalize_free_chunks(unsigned int * free_chunk) {
  unsigned int sz1, sz2;
  unsigned int * next;
  assert(free_chunk);
  assert(0x4000 == 0xc000 & *free_chunk); // ensure that it's free chunk
  next = gc_next_chunk(free_chunk);
  // there's no next chunk:
  if ((unsigned int)next > (unsigned int)memstart + memsize) return;
  // the next chunk is not free:
  sz2 = 0x7ff & *next;
  if (0x4000 != 0xc000 & *next) return;
  // the current free_chunk is already at its max size
  sz1 = 0x7ff & *free_chunk;
  if (0x7ff == sz1) return;
  if (sz1 + sz2 < 0x7ff) {
    // case: merge two blocks (there's a +1 cause the 2nd header is removed)
    *free_chunk = 0x4000 | (sz1 + sz2 + 1);
  } else {
    // case: increment first block, reduce second
    *free_chunk = 0x47ff;
    free_chunk[0x800] = 0x4000 | (sz1 + sz2 - 0x7ff);
  }
}

void gc_register_type(unsigned char tag, struct gc_type_vtable * vtable) {
  assert(tag < 8);
  vtables[tag] = vtable;
}

void * gc_alloc(unsigned char tag, unsigned int size) {
  unsigned int * cursor;
  unsigned int sz = (size + 1) >> 1; // adjusted for tag format
  char gc_was_run = 0;
  if (tag > 7 || sz > 0x7ff) {
    return NULL; // values over the allowed limit.
  }
  if (size + 2 > memsize - usedram) {
    // not enough RAM, run a FULLGC and check again...
    gc_run(GC_RUN_FULLGC);
    if (size + 2 > memsize - usedram) return NULL;
    gc_was_run = 1;
  }
  cursor = first_free_chunk;
  // there's ram, so let's see if there's a chunk with enough free space
  while ((unsigned int)cursor < (unsigned int)memstart + memsize) {
    if (0x4000 == 0xc000 & *cursor) { // free ram...
      gc_normalize_free_chunks(cursor);
      if ((0x7ff & *first_free_chunk) >= sz) goto allocate;
    }
    cursor = gc_next_chunk(cursor);
  }
  if (!gc_was_run) gc_run(1); // maybe we can free some ram in the process...
  gc_normalize_free_chunks(first_free_chunk);
  if ((0x7ff & *first_free_chunk) >= sz) {
    cursor = first_free_chunk;
    goto allocate;
  }
  gc_compact(); // but after a compact first_free_chunk must be enough
  gc_normalize_free_chunks(first_free_chunk);
  cursor = first_free_chunk;
allocate: {
    unsigned int oldsz = 0x7ff & *cursor;
    // oldsz          > sz,
    // oldsz - sz     > 0,
    // oldsz - sz - 1 >= 0.
    first_free_chunk += sz + 1;
    // mark the remaining space as free:
    if (oldsz > sz) {
      cursor[sz+1] = 0x4000 | (oldsz - sz - 1);
    } else {
      // update first_free_chunk to the next free chunk
      while (0x4000 != (0xc000 & *first_free_chunk) &&
	  (unsigned int)first_free_chunk < (unsigned int)memstart + memsize) {
	first_free_chunk = gc_next_chunk(first_free_chunk);
      }
    }
    // objects are created in white or gray color depending on the state:
    if (state == GC_STATE_INIT) *cursor = (tag << 11) | sz; // white
    else *cursor = 0x8000 | (tag << 11) | sz; // gray
  }
  return cursor + 1;
}

struct gc_run_privdata {
  int rp; // next object to read
  int items_in_buffer;
  char overflow; // boolean
};
static gc_run_mark_cb(void * ref, struct gc_run_privdata * pd) {
  unsigned int * refobj = (unsigned int *)ref - 1;
  // it must be a valid gc_alloc'ated object:
  assert((unsigned int)memstart <= (unsigned int)ref);
  assert((unsigned int)ref < (unsigned int)memstart + memsize);
  assert(0 == 1 & (unsigned int)ref);
  if (0 != 0xc000 & *refobj) return; // ignore non white
  *refobj |= 0x8000; // paint it gray
  if (pd->items_in_buffer < SCRATCHPAD_SIZE / 2) {
    // there's space in the buffer, add it...
    ((unsigned int**)scratchpad)
      [ (pd->rp + ++(pd->items_in_buffer))%(SCRATCHPAD_SIZE/2) ] = refobj;
  } else {
    pd->overflow = 1;
  }
}

void gc_run(int steps) {
  // 1. To avoid stack overflows, a circular buffer (temporary stored in the
  //    scratchpad) is used for traversing the graph of references in BFS
  //    order.
  // 2. An iteration ends whenever the circular buffer ends up empty (except
  //    point 4.2). Because the circular buffer has fixed size, there could be
  //    the case in which it'd be attempted to add an element to the full
  //    circular while it was full, resulting on not all references to be
  //    traversed in a single iteration; in this case a new iteration would be
  //    done using 4.2 if allowed by steps, otherwise the pool is set to
  //    GC_STATE_INCOMPLETE state and gc_run returns. However, if there were
  //    not any gray elements in the circular buffer after the traverse
  //    finishes while not having any buffer overflow on the traverse, then it
  //    continues to the next step (3.).
  // 3. If after traversing there were no more gray objects in all the pool,
  //    then the sweeping iteration is done. For each element: if it was white
  //    it's cleaned, if it was black it is set white. After finishing the
  //    sweeping iteration the pool state goes back to GC_STATE_INIT.
  // 4. Because the mark iterations need to know which gray object are there
  //    in the pool:
  //   4.1. If the state was GC_STATE_INIT, then the single gray element in
  //        the pool is *root_object_reference.
  //   4.1. However if the state was GC_STATE_INCOMPLETE, a pointer for
  //        iterating all the objects in the pool is needed, thus the
  //        algorithm specified in 2.  changes a little: While there are
  //        objects in the circular buffer the BFS algorithm is run, and
  //        whenever the buffer gets empty the previously mentioned pointer is
  //        advanced ignoring white and black objects until a gray one is
  //        found, then added to the buffer and going back to the BFS.  If
  //        this pointer finishes visiting all the objects then the iteration
  //        finishes, going back to step 3.
#define add_to_circular_buffer(item) ((unsigned int**)scratchpad) [ \
    (pd.rp+(++pd.items_in_buffer))%(SCRATCHPAD_SIZE/2) ] = (item)
  struct gc_run_privdata pd; // bcc doesn't support struct initialization
  unsigned int * cursor = memstart;
  pd.rp = pd.items_in_buffer = pd.overflow = 0;
  if (state == GC_STATE_INIT && root_object_reference) {
    add_to_circular_buffer(*root_object_reference);
  }
  while (steps) {
    // mark:
    while (pd.items_in_buffer) {
      unsigned int * obj;
traverse_bfs_with_items:
      obj = ((unsigned int*)scratchpad)[pd.rp++ % (SCRATCHPAD_SIZE/2)];
      pd.items_in_buffer--;
      vtables[(*obj>>11)&7]->visit_references(obj + 1, gc_run_mark_cb, &pd);
      *obj |= 0x4000; // turn on black bit...
    }
    if (state == GC_STATE_INCOMPLETE) {
      // linear iteration through all the objects.
      while ((unsigned int)cursor < (unsigned int)memstart + memsize) {
	if (0x8000 == 0xc000 & *cursor) { // if it is gray
	  add_to_circular_buffer(cursor);
	  goto traverse_bfs_with_items;
	}
	cursor = gc_next_chunk(cursor);
      }
      goto sweep;
    } else if (!pd.overflow) {
      goto sweep;
    } else {
      state = GC_STATE_INCOMPLETE;
    }
    if (steps > 0) steps--;
    pd.overflow = 0;
  }
  return;
#undef add_to_circular_buffer
sweep:
  cursor = memstart;
  while ((unsigned int)cursor < (unsigned int)memstart + memsize) {
    assert(0x8000 == 0xc000 & *cursor);
    if (0x8000 & *cursor) { // if it is black (or gray, but it shouldn't)
      *cursor &= ~0xc000; // set it white
    } else if (0 == 0xc000 & *cursor) { // it it is white
      *cursor |= 0x4000; // set it free
      if (cursor < first_free_chunk) first_free_chunk = cursor;
    }
    cursor = gc_next_chunk(cursor);
  }
  state = GC_STATE_INIT;
}

// -> obj_addr should be pointer to the object, not to the header.
// returns a pointer to the scratchpad where:
//   * if obj_addr was found, then obj_addr==(void*)*return_value,
//     and *(return_value+1) contains the address where it will be relocated.
//   * if it was not found, then 0==*return_value, and it will be the place
//     where it can be added as a new entry on the scratchpad hash table.
unsigned int * gc_compact_find_hash(void * obj_addr) {
  int bucket = (unsigned int)obj_addr ^ (((unsigned int)obj_addr) >> 8);
  while (1) {
    unsigned int * addr = (unsigned int *)scratchpad +
                          ((bucket & (SCRATCHPAD_MASK>>2)) << 1);
    if (!*addr) return addr;
    if (*addr == (unsigned int)obj_addr) return addr;
    bucket++;
  }
}

void gc_compact(void) {
  // each object to be relocated takes 4 bytes in the scratchpad hash table, 2
  // bytes for the old address, and 2 bytes for its delta, 75% is used, thus
  // giving >>2>>1 + >>2>>2:
  unsigned int remaining = (SCRATCHPAD_SIZE >> 3) + (SCRATCHPAD_SIZE >> 4);
  unsigned int * cursor = first_free_chunk;
  unsigned int delta = 0;
  { // clean scratchpad so we can use it as a hash table:
    int i, limit = (SCRATCHPAD >> 1) & ~1;
    for (i = 0; i < limit; i += 2) {
      i[(unsigned int *)scratchpad] = 0;
    }
  }
  while ((unsigned int)cursor < (unsigned int)memstart + memsize &&
      remaining > 0) {
    if (0x4000 == 0xc000 & *cursor) {
      delta += (0x7ff & *cursor) << 1;
    } else if (delta > 0) {
      unsigned int * addr = gc_compact_find_hash(cursor + 1);
      remaining--;
    }
    cursor = gc_next_chunk(cursor);
  }

  // TODO
}

void gc_info(unsigned int * totalram,
    unsigned int * freeram,
    unsigned int * object_count_p,
    unsigned int * cfc_p) { // contiguous free chunks
  if (totalram) *totalram = memsize;
  if (freeram) *freeram = memsize - usedram;
  if (object_count_p || cfc_p) {
    unsigned int * cursor = memstart;
    unsigned int object_count = 0;
    unsigned int cfc = 0;
    char last_chunk_was_free = 0;
    while ((unsigned int)cursor < (unsigned int)memstart + memsize) {
      object_count++;
      if (0x4000 != 0xc000 & *cursor) {
	last_chunk_was_free = 0;
      } else if (!last_chunk_was_free) {
	last_chunk_was_free = 1;
	cfc++;
      }
      cursor = gc_next_chunk(cursor);
    }
    if (object_count_p) *object_count_p = object_count;
    if (cfc_p) *cfc_p = cfc;
  }
}

void gc_init(void * memstart_, unsigned int memsize_,
    void ** root_object_reference_) {
  // ensure memory start & size are 2-byte aligned:
  if (1 & (unsigned int)memstart_) {
    memstart_ = 1 + (char*)memstart_;
    memsize_--;
  }
  memsize_ &= ~1;

  root_object_reference = root_object_reference_;
  memstart = memstart_;
  memsize = memsize_;
  usedram = 0;
  first_free_chunk = NULL;
  while (memsize_ > 0x1000) {
    if (!first_free_chunk) first_free_chunk = memstart_;
    *(unsigned int *)memstart_ = 0x47ff; // 01 00,0 111,1111,1111
    memstart_ = ((char *) memstart_) + 0x1000;
    memsize_ -= 0x1000;
  }
  *(unsigned int *)memstart_ = 0x4000 | ((memsize_ - 2) >> 1);
  if (!first_free_chunk) first_free_chunk = memstart_;
}
