#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>
#include <winsock2.h>
#include <ws2tcpip.h>
#include <direct.h>
#define PATH_SEP '\\'
#define CLOSESOCK closesocket
#else
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>
#define SOCKET int
#define INVALID_SOCKET -1
#define PATH_SEP '/'
#define CLOSESOCK close
#endif

static char www_root[4096];

static int is_dir(const char *p) {
#ifdef _WIN32
    DWORD a = GetFileAttributesA(p);
    return a != INVALID_FILE_ATTRIBUTES && (a & FILE_ATTRIBUTE_DIRECTORY);
#else
    struct stat st;
    return stat(p, &st) == 0 && S_ISDIR(st.st_mode);
#endif
}

static int is_file(const char *p) {
#ifdef _WIN32
    DWORD a = GetFileAttributesA(p);
    return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
#else
    struct stat st;
    return stat(p, &st) == 0 && S_ISREG(st.st_mode);
#endif
}

static void join2(char *out, size_t n, const char *a, const char *b) {
    snprintf(out, n, "%s%c%s", a, PATH_SEP, b);
}

static void find_www(char *out, size_t n) {
    const char *env = getenv("KNIGA_WWW");
    if (env && is_dir(env)) {
        snprintf(out, n, "%s", env);
        return;
    }
#ifdef _WIN32
    char exe[4096];
    GetModuleFileNameA(NULL, exe, sizeof exe);
    char *slash = strrchr(exe, '\\');
    if (slash) *slash = 0;
    join2(out, n, exe, "www");
    if (is_dir(out)) return;
#else
    char exe[4096];
    ssize_t r = readlink("/proc/self/exe", exe, sizeof exe - 1);
    if (r > 0) {
        exe[r] = 0;
        char *slash = strrchr(exe, '/');
        if (slash) *slash = 0;
        join2(out, n, exe, "www");
        if (is_dir(out)) return;
        snprintf(out, n, "%s/../share/kniga/www", exe);
        if (is_dir(out)) return;
    }
    snprintf(out, n, "/usr/share/kniga/www");
    if (is_dir(out)) return;
#endif
    snprintf(out, n, "www");
}

static const char *mime_of(const char *path) {
    const char *dot = strrchr(path, '.');
    if (!dot) return "application/octet-stream";
    if (!strcmp(dot, ".html")) return "text/html; charset=utf-8";
    if (!strcmp(dot, ".js")) return "text/javascript; charset=utf-8";
    if (!strcmp(dot, ".css")) return "text/css; charset=utf-8";
    if (!strcmp(dot, ".json")) return "application/json";
    if (!strcmp(dot, ".svg")) return "image/svg+xml";
    if (!strcmp(dot, ".png")) return "image/png";
    if (!strcmp(dot, ".ico")) return "image/x-icon";
    if (!strcmp(dot, ".woff2")) return "font/woff2";
    if (!strcmp(dot, ".woff")) return "font/woff";
    return "application/octet-stream";
}

static int safe_path(const char *url, char *out, size_t n) {
    const char *q = strchr(url, '?');
    size_t len = q ? (size_t)(q - url) : strlen(url);
    while (len > 0 && url[0] == '/') {
        url++;
        len--;
    }
    if (len == 0) {
        join2(out, n, www_root, "index.html");
        return 1;
    }
    if (strstr(url, "..")) return 0;
    char rel[2048];
    if (len >= sizeof rel) return 0;
    memcpy(rel, url, len);
    rel[len] = 0;
    for (char *p = rel; *p; p++) {
        if (*p == '/') *p = PATH_SEP;
    }
    join2(out, n, www_root, rel);
    return 1;
}

static void send_all(SOCKET s, const char *data, size_t n) {
    size_t off = 0;
    while (off < n) {
#ifdef _WIN32
        int w = send(s, data + off, (int)(n - off), 0);
#else
        ssize_t w = send(s, data + off, n - off, 0);
#endif
        if (w <= 0) return;
        off += (size_t)w;
    }
}

static void handle_client(SOCKET s) {
    char req[4096];
    int n;
#ifdef _WIN32
    n = recv(s, req, sizeof req - 1, 0);
#else
    n = (int)recv(s, req, sizeof req - 1, 0);
#endif
    if (n <= 0) {
        CLOSESOCK(s);
        return;
    }
    req[n] = 0;
    char method[16] = {0}, url[2048] = {0};
    sscanf(req, "%15s %2047s", method, url);
    char path[4096];
    if (!safe_path(url, path, sizeof path)) {
        const char *msg = "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        send_all(s, msg, strlen(msg));
        CLOSESOCK(s);
        return;
    }
    if (is_dir(path)) {
        char tmp[4096];
        join2(tmp, sizeof tmp, path, "index.html");
        snprintf(path, sizeof path, "%s", tmp);
    }
    if (!is_file(path)) {
        join2(path, sizeof path, www_root, "index.html");
    }
    FILE *f = fopen(path, "rb");
    if (!f) {
        const char *msg = "HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nConnection: close\r\n\r\nNot found";
        send_all(s, msg, strlen(msg));
        CLOSESOCK(s);
        return;
    }
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (sz < 0) sz = 0;
    char header[512];
    snprintf(header, sizeof header,
             "HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %ld\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n",
             mime_of(path), sz);
    send_all(s, header, strlen(header));
    char buf[8192];
    size_t r;
    while ((r = fread(buf, 1, sizeof buf, f)) > 0) send_all(s, buf, r);
    fclose(f);
    CLOSESOCK(s);
}

static void open_browser(const char *url) {
#ifdef _WIN32
    ShellExecuteA(NULL, "open", url, NULL, NULL, SW_SHOWNORMAL);
#else
    if (fork() == 0) {
        execlp("xdg-open", "xdg-open", url, (char *)NULL);
        _exit(0);
    }
#endif
}

#ifdef _WIN32
static int copy_tree(const char *from, const char *to);
static int install_windows(void) {
    char exe[4096], dest[4096], dest_exe[4096], dest_www[4096];
    GetModuleFileNameA(NULL, exe, sizeof exe);
    const char *appdata = getenv("LOCALAPPDATA");
    if (!appdata) return 1;
    snprintf(dest, sizeof dest, "%s\\Kniga", appdata);
    CreateDirectoryA(dest, NULL);
    snprintf(dest_www, sizeof dest_www, "%s\\www", dest);
    snprintf(dest_exe, sizeof dest_exe, "%s\\Kniga.exe", dest);
    CopyFileA(exe, dest_exe, FALSE);
    copy_tree(www_root, dest_www);
    char ps[2048];
    snprintf(ps, sizeof ps,
             "powershell -NoProfile -Command \"$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'Книга.lnk')); $s.TargetPath='%s'; $s.WorkingDirectory='%s'; $s.Save()\"",
             dest_exe, dest);
    system(ps);
    printf("Установлено в %s\n", dest);
    return 0;
}

static int copy_tree(const char *from, const char *to) {
    CreateDirectoryA(to, NULL);
    char pattern[4096];
    snprintf(pattern, sizeof pattern, "%s\\*", from);
    WIN32_FIND_DATAA fd;
    HANDLE h = FindFirstFileA(pattern, &fd);
    if (h == INVALID_HANDLE_VALUE) return 1;
    do {
        if (!strcmp(fd.cFileName, ".") || !strcmp(fd.cFileName, "..")) continue;
        char src[4096], dst[4096];
        snprintf(src, sizeof src, "%s\\%s", from, fd.cFileName);
        snprintf(dst, sizeof dst, "%s\\%s", to, fd.cFileName);
        if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) copy_tree(src, dst);
        else CopyFileA(src, dst, FALSE);
    } while (FindNextFileA(h, &fd));
    FindClose(h);
    return 0;
}
#endif

int main(int argc, char **argv) {
    find_www(www_root, sizeof www_root);
#ifdef _WIN32
    if (argc > 1 && !strcmp(argv[1], "--install")) {
        return install_windows();
    }
    WSADATA wsa;
    WSAStartup(MAKEWORD(2, 2), &wsa);
#endif
    char idx[4096];
    join2(idx, sizeof idx, www_root, "index.html");
    if (!is_file(idx)) {
        fprintf(stderr, "Не найдена мастерская (%s).\n", www_root);
        return 1;
    }
    SOCKET ls = socket(AF_INET, SOCK_STREAM, 0);
    int opt = 1;
    setsockopt(ls, SOL_SOCKET, SO_REUSEADDR, (char *)&opt, sizeof opt);
    struct sockaddr_in addr;
    memset(&addr, 0, sizeof addr);
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    addr.sin_port = 0;
    if (bind(ls, (struct sockaddr *)&addr, sizeof addr) != 0) {
        perror("bind");
        return 1;
    }
    socklen_t alen = sizeof addr;
    getsockname(ls, (struct sockaddr *)&addr, &alen);
    listen(ls, 16);
    unsigned port = ntohs(addr.sin_port);
    char url[64];
    snprintf(url, sizeof url, "http://127.0.0.1:%u", port);
    printf("Книга: %s\n", url);
    fflush(stdout);
    open_browser(url);
    for (;;) {
        SOCKET c = accept(ls, NULL, NULL);
        if (c == INVALID_SOCKET) continue;
        handle_client(c);
    }
}
