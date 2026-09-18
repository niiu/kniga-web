#!/bin/sh
set -eu
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/out"
WWW="$ROOT/www"
DEST="/workspace/public/downloads"
VER=1.0.0

mkdir -p "$DEST" "$OUT"

# Ubuntu .deb
PKG="$OUT/deb"
rm -rf "$PKG"
mkdir -p "$PKG/DEBIAN" "$PKG/usr/bin" "$PKG/usr/share/kniga" "$PKG/usr/share/applications" "$PKG/usr/share/pixmaps"
cp "$OUT/kniga" "$PKG/usr/bin/kniga"
chmod 755 "$PKG/usr/bin/kniga"
cp -a "$WWW" "$PKG/usr/share/kniga/www"
cp /tmp/kniga/kniga-engine/src-tauri/icons/128x128.png "$PKG/usr/share/pixmaps/kniga.png"
cat > "$PKG/usr/share/applications/kniga.desktop" <<EOF
[Desktop Entry]
Name=Книга
Comment=Мастерская интерактивных книг
Exec=kniga
Icon=kniga
Terminal=false
Type=Application
Categories=Office;Publishing;
StartupNotify=true
EOF
SIZE=$(du -sk "$PKG" | awk '{print $1}')
cat > "$PKG/DEBIAN/control" <<EOF
Package: kniga
Version: $VER
Section: editors
Priority: optional
Architecture: amd64
Installed-Size: $SIZE
Maintainer: niiu <47475200+niiu@users.noreply.github.com>
Description: Мастерская интерактивных книг
 Локальный редактор Книги: сцены, диалоги, HTML-экспорт.
 Публикация готовой книги — на сайте каталога.
Depends: xdg-utils
EOF
dpkg-deb --root-owner-group --build "$PKG" "$DEST/kniga_${VER}_amd64.deb"

# Windows zip (portable + install)
WIN="$OUT/Kniga-$VER-windows"
rm -rf "$WIN"
mkdir -p "$WIN/www"
cp "$OUT/Kniga.exe" "$WIN/Kniga.exe"
cp -a "$WWW/." "$WIN/www/"
cat > "$WIN/Установить.bat" <<'EOF'
@echo off
cd /d "%~dp0"
Kniga.exe --install
echo.
echo Ярлык «Книга» на рабочем столе. Можно закрыть это окно.
pause
EOF
cat > "$WIN/Читать.txt" <<'EOF'
Книга — мастерская интерактивных книг

Запуск: Kniga.exe (откроется в браузере).
Установка: Установить.bat — копия в папку пользователя и ярлык на рабочем столе.

Готовую книгу опубликуйте на сайте каталога (Файл → Опубликовать, либо загрузите .story / HTML).
EOF
python3 - <<PY
import pathlib, zipfile
src = pathlib.Path("$WIN")
zpath = pathlib.Path("$DEST/Kniga-$VER-windows.zip")
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
    for p in src.rglob("*"):
        if p.is_file():
            z.write(p, p.relative_to(src.parent))
print("zip", zpath, zpath.stat().st_size)
PY

ls -lh "$DEST"
