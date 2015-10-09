CC=bcc
CFLAGS=-Md -ansi -c -O86
LDFLAGS=-i -Md -X-M > main.map.tmp

main.com: main.obj gc.obj
	$(CC) $(LDFLAGS) $^ -o $@
	sort -k4 < main.map.tmp > main.map
	rm main.map.tmp

main.obj: main.c main.h
	$(CC) $(CFLAGS) $< -o $@

gc.obj: gc.c gc.h
	$(CC) $(CFLAGS) $< -o $@

clean:
	rm -f *.obj main.map main.com
