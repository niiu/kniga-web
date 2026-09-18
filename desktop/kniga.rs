use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;

fn www_dir() -> PathBuf {
    if let Ok(p) = env::var("KNIGA_WWW") {
        return PathBuf::from(p);
    }
    if let Ok(exe) = env::current_exe() {
        if let Some(dir) = exe.parent() {
            let beside = dir.join("www");
            if beside.is_dir() {
                return beside;
            }
            let share = dir.join("../share/kniga/www");
            if share.is_dir() {
                return share;
            }
        }
    }
    PathBuf::from("/usr/share/kniga/www")
}

fn mime(path: &Path) -> &'static str {
    match path.extension().and_then(|s| s.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

fn safe_join(root: &Path, url_path: &str) -> Option<PathBuf> {
    let decoded = url_path.split('?').next().unwrap_or("/");
    let decoded = decoded.split('#').next().unwrap_or("/");
    let rel = decoded.trim_start_matches('/');
    if rel.contains('\0') {
        return None;
    }
    let mut out = root.to_path_buf();
    if rel.is_empty() {
        return Some(out.join("index.html"));
    }
    for part in rel.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            return None;
        }
        out.push(part);
    }
    Some(out)
}

fn handle(mut stream: TcpStream, root: &Path) {
    let mut buf = [0u8; 4096];
    let n = match stream.read(&mut buf) {
        Ok(0) | Err(_) => return,
        Ok(n) => n,
    };
    let req = String::from_utf8_lossy(&buf[..n]);
    let path = req.split_whitespace().nth(1).unwrap_or("/");
    let mut file = safe_join(root, path).unwrap_or_else(|| root.join("index.html"));
    if file.is_dir() {
        file.push("index.html");
    }
    if !file.is_file() {
        file = root.join("index.html");
    }
    match fs::read(&file) {
        Ok(body) => {
            let header = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n",
                mime(&file),
                body.len()
            );
            let _ = stream.write_all(header.as_bytes());
            let _ = stream.write_all(&body);
        }
        Err(_) => {
            let body = b"Not found";
            let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: 9\r\nConnection: close\r\n\r\n");
            let _ = stream.write_all(body);
        }
    }
}

fn open_browser(url: &str) {
    let _ = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", "start", "", url]).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(url).spawn()
    } else {
        Command::new("xdg-open").arg(url).spawn()
    };
}

fn install_windows() -> Result<(), String> {
    let exe = env::current_exe().map_err(|e| e.to_string())?;
    let www = www_dir();
    if !www.is_dir() {
        return Err("не найдена папка www".into());
    }
    let dest = env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".into());
    let dest = PathBuf::from(dest).join("Kniga");
    let dest_www = dest.join("www");
    fs::create_dir_all(&dest_www).map_err(|e| e.to_string())?;
    let dest_exe = dest.join("Kniga.exe");
    fs::copy(&exe, &dest_exe).map_err(|e| e.to_string())?;
    copy_dir(&www, &dest_www)?;
    let ps = format!(
        "$desktop = [Environment]::GetFolderPath('Desktop'); $s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop 'Книга.lnk')); $s.TargetPath = '{}'; $s.WorkingDirectory = '{}'; $s.Save()",
        dest_exe.display().to_string().replace('\'', "''"),
        dest.display().to_string().replace('\'', "''"),
    );
    let _ = Command::new("powershell")
        .args(["-NoProfile", "-Command", &ps])
        .status();
    println!("Установлено в {}", dest.display());
    Ok(())
}

fn copy_dir(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src = entry.path();
        let dst = to.join(entry.file_name());
        if src.is_dir() {
            copy_dir(&src, &dst)?;
        } else {
            fs::copy(&src, &dst).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.iter().any(|a| a == "--install") {
        match install_windows() {
            Ok(()) => return,
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(1);
            }
        }
    }
    let root = www_dir();
    if !root.join("index.html").is_file() {
        eprintln!("Не найдена мастерская ({}).", root.display());
        std::process::exit(1);
    }
    let listener = TcpListener::bind("127.0.0.1:0").expect("порт");
    let addr = listener.local_addr().expect("addr");
    let url = format!("http://127.0.0.1:{}", addr.port());
    println!("Книга: {url}");
    open_browser(&url);
    for stream in listener.incoming() {
        if let Ok(stream) = stream {
            let root = root.clone();
            thread::spawn(move || handle(stream, &root));
        }
    }
}
